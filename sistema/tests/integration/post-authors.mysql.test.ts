import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sequelizePackage from 'sequelize';

test('autores das publicações em MySQL descartável', {
  skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || process.env.SWIFTLINE_MYSQL_SUITE !== 'post-authors',
}, async (t) => {
  const expectedDirectory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_NAME, 'swiftline_authors_test');
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('swiftline-authors-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(expectedDirectory)));

  const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
  const { default: app } = require('../../src/app.js') as typeof import('../../src/app.js');
  const { User, Post, SavedPost } = await import('../../src/models/index.js');
  const { secret } = await import('../../src/middleware/auth.js');
  const { assertPostAuthorSchema } = await import('../../src/infrastructure/database/post-author-schema.js');
  const migration = require(path.resolve(__dirname, '../../../migrations/history/20261120000000-use-user-profile-for-post-authors.js'));
  const qi = database.getQueryInterface();
  let server: ReturnType<typeof app.listen> | undefined;
  let baseUrl: string;
  const tag = randomUUID().replaceAll('-', '');
  const oldName = 'autor_anterior_' + tag;
  const newName = 'autor_atual_' + tag;
  let ownerId: number;
  let readerId: number;
  let ownedPostId: number;
  let ownerToken: string;
  let readerToken: string;
  let newAvatar: string;
  const content = 'Conteúdo preservado do autor';

  async function call(url: string, method = 'GET', body?: object, token = readerToken) {
    return fetch(baseUrl + url, {
      method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function postRows() {
    const [rows] = await database.query('SELECT * FROM posts ORDER BY id');
    return JSON.parse(JSON.stringify(rows));
  }
  async function assertCurrentAuthor(url: string, search = false) {
    const response = await call(url);
    assert.equal(response.status, 200, url);
    const result = await response.json();
    const posts = search ? result.posts : result;
    const post = posts.find((item: { id: number }) => item.id === ownedPostId);
    assert.ok(post, 'Publicação ausente: ' + url);
    assert.equal(post.author, newName, url);
    assert.equal(post.avatar, newAvatar, url);
    assert.equal(post.password, undefined);
    assert.equal(post.email, undefined);
  }

  try {
    await database.authenticate();
    const [rows] = await database.query('SELECT @@datadir AS directory');
    const actual = (rows as Array<{ directory: string }>)[0].directory;
    const normalize = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    assert.equal(normalize(actual), normalize(expectedDirectory));
    const { prepareMigratedTestDatabase } = await import('../helpers/prepare-migrated-database.js');
    await prepareMigratedTestDatabase();
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    baseUrl = 'http://127.0.0.1:' + address.port;
    const users = await User.bulkCreate([
      { username: oldName, email: 'autor-' + tag + '@example.test', password: await bcrypt.hash('senha-teste', 4), avatar: '/uploads/foto-anterior.png' },
      { username: 'leitor_' + tag, email: 'leitor-' + tag + '@example.test', password: await bcrypt.hash('senha-teste', 4) },
    ]);
    [ownerId, readerId] = users.map((user) => user.id);
    ownerToken = jwt.sign({ id: ownerId }, secret());
    readerToken = jwt.sign({ id: readerId }, secret());

    await t.test('criar publicação guarda a referência do autor e mantém os dados esperados pela interface', async () => {
      const response = await call('/api/posts', 'POST', { content, author: 'Nome enviado pelo cliente', avatar: 'imagem-enviada.png' }, ownerToken);
      assert.equal(response.status, 201);
      const result = await response.json();
      ownedPostId = result.id;
      assert.equal(result.author, oldName);
      assert.equal(result.avatar, '/uploads/foto-anterior.png');
      assert.equal(result.userId, ownerId);
      const columns = await qi.describeTable('posts');
      assert.equal(columns.author, undefined);
      assert.equal(columns.avatar, undefined);
      await SavedPost.create({ userId: readerId, postId: ownedPostId });
    });

    await t.test('trocar nome e foto altera apenas o perfil e atualiza feed, perfil, salvos e busca', async () => {
      const before = await postRows();
      const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      const response = await call('/api/auth/profile', 'PUT', { username: newName, avatar: gif }, ownerToken);
      assert.equal(response.status, 200);
      const result = await response.json();
      newAvatar = result.user.avatar;
      assert.match(newAvatar, /^\/uploads\/managed\/[0-9a-f-]+\.gif$/);
      assert.equal(result.user.username, newName);
      assert.deepEqual(await postRows(), before);
      await assertCurrentAuthor('/api/posts');
      await assertCurrentAuthor('/api/posts?username=' + encodeURIComponent(newName));
      await assertCurrentAuthor('/api/posts/saved');
      await assertCurrentAuthor('/api/search?q=' + encodeURIComponent(newName), true);
      const oldSearch = await call('/api/search?q=' + encodeURIComponent(oldName));
      assert.ok(!(await oldSearch.json()).posts.some((post: { id: number }) => post.id === ownedPostId));
    });

    await t.test('editar e criar novas publicações devolve o perfil atual do autor', async () => {
      const edited = await call('/api/posts/' + ownedPostId, 'PUT', { content }, ownerToken);
      assert.equal(edited.status, 200);
      assert.equal((await edited.json()).post.author, newName);
      const created = await call('/api/posts', 'POST', { content: 'Nova publicação após trocar perfil' }, ownerToken);
      assert.equal(created.status, 201);
      const result = await created.json();
      assert.equal(result.author, newName);
      assert.equal(result.avatar, newAvatar);
    });

    await t.test('o navegador apresenta o nome e a foto atuais no feed, no perfil e nos salvos', async () => {
      const { chromium, expect } = await import('@playwright/test');
      const candidate = process.env.SWIFTLINE_CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
      const browser = await chromium.launch({ headless: true, ...(fs.existsSync(candidate) ? { executablePath: candidate } : {}) });
      try {
        const context = await browser.newContext();
        await context.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
          if (url.pathname === '/api/v2/news') return route.fulfill({ json: { news: [] } });
          if (url.pathname === '/api/v2/trends') return route.fulfill({ json: { trends: [] } });
          return route.continue();
        });
        await context.addInitScript(({ token, user }) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }, { token: readerToken, user: { id: readerId, username: 'leitor_' + tag, email: 'leitor-' + tag + '@example.test' } });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const checkPost = async () => {
          const article = page.locator('article').filter({ hasText: content }).first();
          await expect(article).toBeVisible();
          await expect(article).toContainText(newName);
          await expect(article.locator('img').first()).toHaveAttribute('src', newAvatar);
        };
        await page.goto(baseUrl + '/feed.html');
        await checkPost();
        await page.goto(baseUrl + '/profile.html?id=' + ownerId);
        await checkPost();
        await page.getByRole('button', { name: 'Salvos', exact: true }).click();
        await checkPost();
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });

    await t.test('a migração preserva as cópias em backup, remove as colunas e permite restauração', async () => {
      await qi.addColumn('posts', 'author', { type: sequelizePackage.STRING, allowNull: true });
      await qi.addColumn('posts', 'avatar', { type: sequelizePackage.TEXT, allowNull: true });
      await database.query('UPDATE posts SET author = :author, avatar = :avatar', { replacements: { author: 'Cópia histórica', avatar: '/uploads/copia-historica.png' } });
      await qi.changeColumn('posts', 'author', { type: sequelizePackage.STRING, allowNull: false });
      const before = await postRows();
      await assert.rejects(assertPostAuthorSchema(database), /db:migrate/);
      const result = await migration.up(qi, sequelizePackage);
      assert.equal(result.changed, true);
      assert.equal(result.total, before.length);
      await assertPostAuthorSchema(database);
      const [backup] = await database.query('SELECT postId AS id, userId, author, avatar FROM ' + migration.BACKUP_TABLE + ' WHERE postId IS NOT NULL ORDER BY postId');
      assert.deepEqual(backup, before.map((post: Record<string, unknown>) => ({ id: post.id, userId: post.userId, author: post.author, avatar: post.avatar })));
      assert.equal((await migration.up(qi, sequelizePackage)).changed, false);
      await assertCurrentAuthor('/api/posts');
      await migration.down(qi, sequelizePackage);
      assert.deepEqual(await postRows(), before);
      const restored = await qi.describeTable('posts');
      assert.equal(restored.author.allowNull, false);
      assert.equal(restored.avatar.type, 'TEXT');
      await migration.up(qi, sequelizePackage);
      await assertCurrentAuthor('/api/posts');
    });

    await t.test('a migração recusa publicações sem usuário válido e conserva as colunas antigas', async () => {
      await migration.down(qi, sequelizePackage);
      const references = await qi.getForeignKeyReferencesForTable('posts') as Array<{ columnName: string; constraintName: string }>;
      for (const reference of references.filter((item) => item.columnName === 'userId'))
        await qi.removeConstraint('posts', reference.constraintName);
      await qi.bulkInsert('posts', [{ userId: 999999, author: 'Sem usuário válido', content: 'Registro para conferir a proteção', createdAt: new Date(), updatedAt: new Date() }]);
      const before = await postRows();
      await assert.rejects(migration.up(qi, sequelizePackage), /sem usuário válido/);
      assert.deepEqual(await postRows(), before);
      assert.ok((await qi.describeTable('posts')).author);
      assert.ok(!(await qi.showAllTables()).includes(migration.BACKUP_TABLE));
    });
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await database.close();
  }
});
