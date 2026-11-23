import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { decodePage, decodePost, decodeComment, decodeMessage, decodeNotification, decodeUser } from '../../shared/contracts/index.js';

test('contratos v2 e recuperação das telas em MySQL descartável', {
  skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || process.env.SWIFTLINE_MYSQL_SUITE !== 'api-contracts',
}, async (t) => {
  assert.equal(process.env.DB_HOST, '127.0.0.1'); assert.equal(process.env.DB_NAME, 'swiftline_contracts_test');
  const directory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.ok(path.basename(path.dirname(directory)).startsWith('swiftline-contracts-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(directory)));
  const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
  const { default: app } = require('../../src/app.js') as typeof import('../../src/app.js');
  const { User, Post, Comment, Message, Notification, Follow, Like, SavedPost, Repost, PollOption, PollVote } = await import('../../src/models/index.js');
  const { secret } = await import('../../src/middleware/auth.js');
  const { prepareMigratedTestDatabase } = await import('../helpers/prepare-migrated-database.js');
  await prepareMigratedTestDatabase();
  const password = 'Senha!teste'; const hash = await bcrypt.hash(password, 4);
  const [owner, viewer, other] = await User.bulkCreate(['autor', 'leitor', 'outra'].map((username) => ({ username, email: username + '@example.test', password: hash })));
  const sameDate = new Date('2026-11-01T00:00:00.000Z');
  const posts = await Post.bulkCreate(Array.from({ length: 56 }, (_, index) => ({ userId: owner.id, content: 'Publicação ' + index, createdAt: sameDate })));
  await database.query('UPDATE posts SET createdAt=NULL WHERE id=?', { replacements: [posts[0].id] });
  const target = posts.at(-1)!;
  await Comment.bulkCreate(Array.from({ length: 55 }, (_, index) => ({ userId: viewer.id, postId: target.id, content: 'Comentário ' + index, createdAt: sameDate })));
  const messages = await Message.bulkCreate(Array.from({ length: 55 }, (_, index) => ({ senderId: viewer.id, receiverId: owner.id, content: 'Mensagem ' + index, createdAt: sameDate })));
  await Notification.bulkCreate(Array.from({ length: 25 }, (_, index) => ({ userId: viewer.id, actorId: owner.id, type: 'comment', message: 'Aviso ' + index, createdAt: sameDate })));
  await SavedPost.bulkCreate(posts.slice(0, 25).map((post) => ({ postId: post.id, userId: viewer.id, createdAt: sameDate })));
  await User.bulkCreate(Array.from({ length: 25 }, (_, index) => ({ username: 'contato' + index, email: 'contato' + index + '@example.test', password: hash, createdAt: sameDate })));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port, token = jwt.sign({ id: viewer.id }, secret());
  async function call(url: string, method = 'GET', body?: unknown, asToken: string | null = token) {
    return fetch(base + url, { method, headers: { ...(asToken ? { Authorization: 'Bearer ' + asToken } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function failure(response: Response, code: string, status: number) {
    assert.equal(response.status, status); assert.match(response.headers.get('content-type')!, /application\/json/);
    const data = await response.json(); assert.equal(data.error.code, code); assert.ok(data.requestId); assert.equal(data.requestId, response.headers.get('x-request-id')); return data;
  }
  let browser: Awaited<ReturnType<(typeof import('@playwright/test'))['chromium']['launch']>> | undefined;
  try {
    await t.test('listas limitam a consulta, preservam empates e entregam todas as páginas sem repetição', async (st) => {
      const original = Post.findAll.bind(Post); const limits: unknown[] = [];
      st.mock.method(Post, 'findAll', async (options: Parameters<typeof Post.findAll>[0]) => { limits.push(options?.limit); return original(options); });
      for (const [url, expected, decode] of [
        ['/api/v2/posts', 56, decodePost], ['/api/v2/posts/saved', 25, decodePost],
        [`/api/v2/posts/${target.id}/comments`, 55, decodeComment], [`/api/v2/messages/${owner.id}`, 55, decodeMessage],
        ['/api/v2/notifications', 25, decodeNotification], ['/api/v2/messages/people', 27, decodeUser], ['/api/v2/users/search', 27, decodeUser],
      ] as const) {
        const seen: number[] = []; let cursor: string | null = null; let first = true;
        do {
          const response = await call(url + (cursor ? '?cursor=' + cursor : '')); assert.equal(response.status, 200, url);
          const data = decodePage(decode as (value: unknown) => { id: number })(await response.json());
          assert.ok(data.items.length <= 20, url); if (first) assert.equal(data.items.length, 20, url); first = false;
          seen.push(...data.items.map((item) => item.id)); cursor = data.nextCursor;
        } while (cursor);
        assert.equal(seen.length, expected, url); assert.equal(new Set(seen).size, expected, url);
        if (url.endsWith('/messages/' + owner.id)) assert.deepEqual(seen, messages.map((message) => message.id).reverse());
      }
      assert.ok(limits.length > 2); assert.ok(limits.every((limit) => typeof limit === 'number' && limit <= 51));
      const [legacy, current] = await Promise.all([call('/api/posts'), call('/api/v2/posts?limit=3')]);
      assert.ok(Array.isArray(await legacy.json())); assert.equal((await current.json()).items.length, 3);
      await failure(await call('/api/v2/posts?limit=51'), 'VALIDATION_ERROR', 400);
      await failure(await call('/api/v2/posts?cursor=invalido'), 'VALIDATION_ERROR', 400);
      const first = await (await call('/api/v2/posts?limit=2')).json();
      await failure(await call('/api/v2/posts/saved?cursor=' + first.nextCursor), 'VALIDATION_ERROR', 400);
      const feed = await (await call('/api/v2/posts')).json(); assert.ok(!feed.items.some((post: { id: number }) => post.id === posts[0].id));
      assert.equal(decodePost(await (await call('/api/v2/posts/' + posts[0].id)).json()).id, posts[0].id);
    });
    await t.test('o mesmo limite Unicode vale para criar, editar e alterar a pergunta da enquete', async () => {
      const ownerToken = jwt.sign({ id: owner.id }, secret()); const content = '😀'.repeat(280);
      let response = await call('/api/v2/posts', 'POST', { content }, ownerToken); assert.equal(response.status, 201); const created = decodePost(await response.json()); assert.equal(created.content, content);
      response = await call('/api/v2/posts/' + created.id, 'PUT', { content: content + 'x' }, ownerToken); assert.ok((await failure(response, 'VALIDATION_ERROR', 400)).error.fields.content);
      response = await call('/api/v2/posts/' + created.id, 'PUT', { content }, ownerToken); assert.equal(response.status, 200);
      response = await call('/api/v2/posts', 'POST', { content: 'Pergunta', pollOptions: ['A', 'B'] }, ownerToken); assert.equal(response.status, 201); const pollPost = decodePost(await response.json());
      const options = pollPost.poll!.options.map(({ id, text }) => ({ id, text }));
      await failure(await call('/api/v2/posts/' + pollPost.id + '/poll', 'PUT', { question: content + 'x', options }, ownerToken), 'VALIDATION_ERROR', 400);
      assert.equal((await call('/api/v2/posts/' + pollPost.id + '/poll', 'PUT', { question: content, options }, ownerToken)).status, 200);
    });
    await t.test('localização e site sobrevivem à atualização e a uma nova leitura do perfil', async () => {
      const result = await call('/api/v2/auth/profile', 'PUT', { location: 'Manaus', website: 'https://example.test/ane' }); assert.equal(result.status, 200);
      const data = await result.json(); assert.equal(data.user.location, 'Manaus'); assert.equal(data.user.website, 'https://example.test/ane'); assert.equal(data.user.password, undefined);
      const current = decodeUser(await (await call('/api/v2/auth/me')).json()); assert.equal(current.website, 'https://example.test/ane');
      await failure(await call('/api/v2/auth/profile', 'PUT', { website: 'javascript:alert(1)' }), 'VALIDATION_ERROR', 400);
    });
    await t.test('repetir o estado desejado não desfaz curtida, salvo, repostagem, seguir nem voto', async () => {
      for (const [action, field, model] of [['like', 'liked', Like], ['save', 'saved', SavedPost], ['repost', 'reposted', Repost]] as const) {
        for (const value of [true, false]) {
          const results = await Promise.all([call(`/api/v2/posts/${target.id}/${action}`, 'POST', { [field]: value }), call(`/api/v2/posts/${target.id}/${action}`, 'POST', { [field]: value })]);
          for (const response of results) { assert.equal(response.status, 200); assert.equal((await response.json())[field], value); }
          assert.equal(await model.count({ where: { postId: target.id, userId: viewer.id } }), value ? 1 : 0);
        }
      }
      for (const value of [true, true, false, false]) { const response = await call('/api/v2/follow/follow/' + owner.username, 'POST', { following: value }); assert.equal(response.status, 200); assert.equal((await response.json()).following, value); }
      assert.equal(await Follow.count({ where: { followerId: viewer.id, followingId: owner.id } }), 0);
      assert.equal(await Notification.count({ where: { actorId: viewer.id, userId: owner.id, type: 'follow' } }), 1);
      const option = await PollOption.create({ postId: target.id, text: 'Opção', position: 0 });
      for (let index = 0; index < 2; index++) { const response = await call(`/api/v2/posts/${target.id}/poll-vote`, 'POST', { optionId: option.id }); assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.poll.totalVotes, 1); assert.equal(data.poll.votedOptionId, option.id); }
      assert.equal(await PollVote.count({ where: { postId: target.id, userId: viewer.id } }), 1);
      await failure(await call(`/api/v2/posts/${target.id}/like`, 'POST', { liked: 'true' }), 'VALIDATION_ERROR', 400);
    });
    await t.test('sessão inválida, credenciais incorretas e entrada malformada possuem códigos distintos', async () => {
      await failure(await call('/api/v2/auth/me', 'GET', undefined, null), 'SESSION_INVALID', 401);
      await failure(await call('/api/v2/auth/me', 'GET', undefined, jwt.sign({ id: 999999 }, secret())), 'SESSION_INVALID', 401);
      await failure(await call('/api/v2/auth/delete', 'DELETE', { password: 'incorreta' }), 'INVALID_CREDENTIALS', 401);
      assert.ok(await User.findByPk(viewer.id)); assert.equal((await call('/api/v2/auth/me')).status, 200);
      await failure(await call('/api/v2/auth/login', 'POST', { email: viewer.email, password: 'incorreta' }, null), 'INVALID_CREDENTIALS', 401);
      const malformed = await fetch(base + '/api/v2/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":' }); await failure(malformed, 'VALIDATION_ERROR', 400);
      await failure(await call('/api/v2/inexistente'), 'NOT_FOUND', 404);
      await failure(await call('/api/v2/posts/abc'), 'VALIDATION_ERROR', 400);
    });
    await t.test('falha do banco responde JSON genérico sem SQL nem detalhes privados', async (st) => {
      st.mock.method(Post, 'findAll', async () => { throw new Error('SELECT senha FROM dados_privados'); });
      const data = await failure(await call('/api/v2/posts'), 'INTERNAL_ERROR', 500); assert.ok(!JSON.stringify(data).includes('SELECT')); assert.ok(!JSON.stringify(data).includes('senha'));
    });
    const { chromium, expect } = await import('@playwright/test');
    const candidate = process.env.SWIFTLINE_CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(candidate) ? { executablePath: candidate } : {}) });
    const errors: string[] = [];
    async function context() {
      const context = await browser!.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.route('**/*', async (route) => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') return route.abort(); if (url.pathname.endsWith('/news')) return route.fulfill({ json: { news: [] } }); return route.continue(); });
      const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/login.html'); await page.evaluate(({ token, viewer }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(viewer)); }, { token, viewer: { id: viewer.id, username: viewer.username, email: viewer.email } });
      return { context, page };
    }
    await t.test('salvos abre por endereço, recarrega, pagina e mantém voltar/avançar', async () => {
      const { context: ctx, page } = await context();
      try {
        await page.goto(base + '/saved.html'); await expect(page.getByRole('heading', { name: 'Publicações salvas' })).toBeVisible();
        await expect(page.locator('.post')).toHaveCount(20); await page.getByRole('button', { name: 'Carregar mais', exact: true }).first().click(); await expect(page.locator('.post')).toHaveCount(25);
        await page.reload(); await expect(page.getByRole('heading', { name: 'Publicações salvas' })).toBeVisible(); await expect(page.locator('.post')).toHaveCount(20);
        await page.getByRole('button', { name: 'Início', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Sua timeline' })).toBeVisible();
        await page.goBack(); await expect(page.getByRole('heading', { name: 'Publicações salvas' })).toBeVisible(); await page.goForward(); await expect(page.getByRole('heading', { name: 'Sua timeline' })).toBeVisible();
        await page.goto(base + '/feed.html#post-' + posts[0].id); await expect(page.locator('#post-' + posts[0].id)).toBeVisible();
      } finally { await ctx.close(); }
    });
    await t.test('lista inválida e HTML viram aviso com nova tentativa sem derrubar a tela', async () => {
      const { context: ctx, page } = await context(); let bad = true;
      await page.route('**/api/v2/posts', (route) => bad ? route.fulfill({ json: { error: 'isto não é lista' } }) : route.continue());
      try {
        await page.goto(base + '/feed.html'); await expect(page.locator('.post-list-feedback[role=alert]')).toBeVisible();
        bad = false; await page.locator('.post-list-feedback').getByRole('button', { name: 'Tentar novamente' }).click(); await expect(page.locator('.post')).toHaveCount(20);
        await page.unroute('**/api/v2/posts'); await page.route('**/api/v2/posts', (route) => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>erro</html>' }));
        await page.reload(); await expect(page.locator('.post-list-feedback[role=alert]')).toBeVisible();
      } finally { await ctx.close(); }
    });
    await t.test('troca rápida de conversa ignora resposta atrasada e apresenta só as mensagens escolhidas', async () => {
      const { context: ctx, page } = await context(); let release!: () => void, entered!: () => void;
      const waiting = new Promise<void>((resolve) => { release = resolve; }); const requested = new Promise<void>((resolve) => { entered = resolve; });
      await page.route('**/api/v2/messages/' + owner.id, async (route) => { entered(); await waiting; try { await route.fulfill({ json: { items: [{ id: 9999, senderId: owner.id, receiverId: viewer.id, content: 'RESPOSTA ATRASADA', createdAt: sameDate.toISOString() }], nextCursor: null } }); } catch {} });
      await Message.create({ senderId: other.id, receiverId: viewer.id, content: 'Conversa escolhida' });
      try {
        await page.goto(base + '/messages.html'); await page.getByLabel('Buscar pessoa nas mensagens').fill(owner.username); await page.locator('.conversation-list button').filter({ hasText: owner.username }).click(); await requested;
        await page.getByLabel('Buscar pessoa nas mensagens').fill(other.username); await page.locator('.conversation-list button').filter({ hasText: other.username }).click();
        await expect(page.locator('.message-list')).toContainText('Conversa escolhida'); release(); await page.waitForTimeout(250); await expect(page.locator('.message-list')).not.toContainText('RESPOSTA ATRASADA');
      } finally { release(); await ctx.close(); }
    });
    await t.test('sessão expirada abre login; senha incorreta na exclusão conserva conta e sessão', async () => {
      const { context: ctx, page } = await context();
      try {
        await page.goto(base + '/settings.html'); await page.getByRole('button', { name: 'Excluir minha conta' }).click(); await page.getByLabel('Digite sua senha para confirmar').fill('incorreta'); await page.getByRole('button', { name: 'Excluir conta', exact: true }).click();
        await expect(page.locator('.delete-modal')).toContainText('Senha'); assert.equal(await page.evaluate(() => localStorage.getItem('token')), token); assert.ok(await User.findByPk(viewer.id));
        await page.route('**/api/v2/auth/me', (route) => route.fulfill({ status: 401, json: { error: { code: 'SESSION_INVALID', message: 'Entre novamente.' }, requestId: 'expirada' } }));
        await page.reload(); await expect(page.locator('.auth-card')).toBeVisible(); assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
      } finally { await ctx.close(); }
      assert.deepEqual(errors, []);
    });
    await t.test('cópia local na versão 5 recebe a migração 6 sem alterar valores anteriores', { skip: !process.env.SWIFTLINE_DATABASE_SNAPSHOT }, async () => {
      const { connectForMigrations, migrateDatabase, databaseStatus } = await import('../../src/infrastructure/database/migrations.js');
      const { inspectSchema, quote, rows } = await import('../../src/infrastructure/database/schema-inspection.js');
      const connection = await connectForMigrations();
      try {
        const saved = JSON.parse(fs.readFileSync(process.env.SWIFTLINE_DATABASE_SNAPSHOT!, 'utf8')) as { tables: Record<string, { create: string; rows: Record<string, unknown>[]; columns: Record<string, { type: string }> }> };
        await connection.query('SET FOREIGN_KEY_CHECKS=0');
        try {
          for (const table of Object.values(await inspectSchema(connection))) await connection.query('DROP TABLE ' + quote(table.name));
          for (const table of Object.values(saved.tables)) await connection.query(table.create);
          for (const [name, table] of Object.entries(saved.tables)) for (const row of table.rows) { const columns = Object.keys(row); const values = columns.map((column) => /^(DATE|DATETIME|TIMESTAMP)/.test(table.columns[column].type) && row[column] ? new Date(String(row[column])) : row[column]); await connection.query(`INSERT INTO ${quote(name)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values); }
        } finally { await connection.query('SET FOREIGN_KEY_CHECKS=1'); }
        assert.deepEqual(await migrateDatabase(connection), ['0006-api-contracts.js']);
        const canonical = (data: Record<string, unknown>[]) => data.map((row) => JSON.stringify(row, Object.keys(row).sort())).sort();
        for (const [name, table] of Object.entries(saved.tables)) {
          let current = await rows<Record<string, unknown>>(connection, 'SELECT * FROM ' + quote(name));
          if (name === 'swiftline_schema_migrations') current = current.filter((row) => row.version !== '0006-api-contracts.js');
          if (name.toLowerCase() === 'users') { for (const row of current) { assert.equal(row.location, ''); assert.equal(row.website, ''); delete row.location; delete row.website; } }
          assert.deepEqual(canonical(current), canonical(table.rows), name);
        }
        assert.equal((await databaseStatus(connection)).ready, true);
      } finally { await connection.end(); }
    });
  } finally { await browser?.close(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await database.close(); }
});
