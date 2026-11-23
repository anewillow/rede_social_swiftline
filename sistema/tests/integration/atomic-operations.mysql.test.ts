import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

test('operações e limpeza recuperável em MySQL descartável', {
  skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || process.env.SWIFTLINE_MYSQL_SUITE !== 'atomic-operations',
}, async (t) => {
  const expectedDirectory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_NAME, 'swiftline_atomic_test');
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('swiftline-atomic-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(expectedDirectory)));
  const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
  const { default: app } = require('../../src/app.js') as typeof import('../../src/app.js');
  const { User, Post, Comment, Like, Follow, Notification, PollOption, PollVote, SavedPost, Repost, Message } = await import('../../src/models/index.js');
  const { prepareMigratedTestDatabase } = await import('../helpers/prepare-migrated-database.js');
  const { createImageMaintenance, imageMaintenance, enqueueImageCleanup, cleanupKey } = await import('../../src/infrastructure/storage/file-cleanup.js');
  const { secret } = await import('../../src/middleware/auth.js');
  const { managedUploadsPath: managed, stagedUploadsPath: staging } = await import('../../src/config/paths.js');
  await prepareMigratedTestDatabase();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port;
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
  const dataUrl = 'data:image/gif;base64,' + gif.toString('base64');
  const password = 'senha-do-teste';
  const hash = await bcrypt.hash(password, 4);
  async function seed() {
    const tag = randomUUID().replaceAll('-', '');
    const [owner, actor] = await User.bulkCreate(['autor', 'leitor'].map((name) => ({ username: name + tag, email: name + tag + '@example.test', password: hash })));
    const post = await Post.create({ userId: owner.id, content: 'Texto ' + tag });
    return { owner, actor, post };
  }
  async function call(userId: number, url: string, method = 'POST', body?: object | FormData) {
    const multipart = body instanceof FormData;
    return fetch(base + url, { method, headers: { Authorization: 'Bearer ' + jwt.sign({ id: userId }, secret()), ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}) }, body: multipart ? body : body ? JSON.stringify(body) : undefined });
  }
  function imageForm(content = 'Publicação com imagem', bytes = gif, mime = 'image/gif') {
    const form = new FormData(); form.set('content', content); form.set('image', new Blob([bytes], { type: mime }), '../../nome-do-cliente.gif'); return form;
  }
  const files = (directory: string) => fs.readdir(directory).then((items) => items.sort()).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  async function queueCount() { const [rows] = await database.query('SELECT COUNT(*) AS total FROM file_cleanup_jobs'); return Number((rows as Array<{ total: number }>)[0].total); }
  async function exists(url: string) { await fs.access(path.join(process.cwd(), 'public', url.replace(/^\//, ''))); }
  try {
    for (const kind of ['comment', 'like', 'follow'] as const) await t.test(kind + ': falha da notificação desfaz a ação, e a tentativa seguinte conclui ambas', async (st) => {
      const { owner, actor, post } = await seed();
      const url = kind === 'comment' ? `/api/posts/${post.id}/comments` : kind === 'like' ? `/api/posts/${post.id}/like` : '/api/follow/follow/' + owner.username;
      const body = kind === 'comment' ? { content: 'Comentário atômico' } : undefined;
      st.mock.method(Notification, 'create', async (_data: object, options: { transaction?: unknown }) => { assert.ok(options.transaction); throw new Error('Falha controlada na notificação'); });
      let response = await call(actor.id, url, 'POST', body);
      assert.equal(response.status, 500); await response.text();
      assert.equal(await Comment.count({ where: { postId: post.id } }), 0);
      assert.equal(await Like.count({ where: { postId: post.id } }), 0);
      assert.equal(await Follow.count({ where: { followerId: actor.id } }), 0);
      assert.equal((await Post.findByPk(post.id))!.likes, 0);
      assert.equal(await Notification.count({ where: { actorId: actor.id } }), 0);
      st.mock.restoreAll();
      response = await call(actor.id, url, 'POST', body);
      assert.equal(response.status, kind === 'comment' ? 201 : 200); await response.json();
      assert.equal(await Notification.count({ where: { actorId: actor.id, type: kind } }), 1);
      const count = kind === 'comment' ? await Comment.count({ where: { postId: post.id } }) : kind === 'like' ? await Like.count({ where: { postId: post.id } }) : await Follow.count({ where: { followerId: actor.id } });
      assert.equal(count, 1);
    });
    await t.test('pedidos simultâneos preservam contagens, relações únicas e um voto por pessoa', async () => {
      const { owner, actor, post } = await seed();
      await database.query('UPDATE posts SET shares=NULL WHERE id=?', { replacements: [post.id] });
      const shares = await Promise.all(Array.from({ length: 12 }, () => call(actor.id, `/api/posts/${post.id}/share`)));
      for (const response of shares) { assert.equal(response.status, 200); await response.json(); }
      assert.equal((await Post.findByPk(post.id))!.shares, 12);
      const follows = await Promise.all(Array.from({ length: 4 }, () => call(actor.id, '/api/follow/follow/' + owner.username)));
      for (const response of follows) { assert.equal(response.status, 200); await response.json(); }
      assert.equal(await Follow.count({ where: { followerId: actor.id, followingId: owner.id } }), 1);
      assert.equal(await Notification.count({ where: { actorId: actor.id, type: 'follow' } }), 1);
      for (const [action, model] of [['like', Like], ['save', SavedPost], ['repost', Repost]] as const) {
        const responses = await Promise.all([call(actor.id, `/api/posts/${post.id}/${action}`), call(actor.id, `/api/posts/${post.id}/${action}`)]);
        for (const response of responses) { assert.equal(response.status, 200); await response.json(); }
        assert.equal(await model.count({ where: { postId: post.id, userId: actor.id } }), 0);
      }
      const option = await PollOption.create({ postId: post.id, text: 'Uma opção', position: 0 });
      const votes = await Promise.all([call(actor.id, `/api/posts/${post.id}/poll-vote`, 'POST', { optionId: option.id }), call(actor.id, `/api/posts/${post.id}/poll-vote`, 'POST', { optionId: option.id })]);
      assert.deepEqual(votes.map((response) => response.status).sort(), [200, 409]);
      for (const response of votes) await response.json();
      assert.equal(await PollVote.count({ where: { postId: post.id, userId: actor.id } }), 1);
    });
    await t.test('imagens rejeitadas saem da área privada e não entram no armazenamento definitivo', async () => {
      const { owner } = await seed();
      const before = await files(managed);
      const invalidPoll = imageForm(); invalidPoll.set('pollOptions', '["Única"]');
      const cases: Array<[FormData, number]> = [
        [invalidPoll, 400], [imageForm('Texto', Buffer.from('texto falso'), 'image/gif'), 400],
        [imageForm('Texto', Buffer.from('texto'), 'text/plain'), 415],
        [imageForm('Texto', Buffer.alloc(3 * 1024 * 1024 + 1), 'image/gif'), 413],
      ];
      for (const [form, status] of cases) { const response = await call(owner.id, '/api/posts', 'POST', form); assert.equal(response.status, status); await response.text(); }
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.deepEqual(await files(managed), before);
      assert.deepEqual(await files(staging), []);
    });
    await t.test('falha na enquete ou na montagem da resposta desfaz a publicação e remove a imagem nova', async (st) => {
      const { owner } = await seed();
      const before = await files(managed), count = await Post.count();
      st.mock.method(PollOption, 'bulkCreate', async () => { throw new Error('Falha controlada nas opções'); });
      const form = imageForm(); form.set('pollOptions', '["A","B"]');
      let response = await call(owner.id, '/api/posts', 'POST', form);
      assert.equal(response.status, 500); await response.text();
      assert.equal(await Post.count(), count); assert.deepEqual(await files(managed), before);
      st.mock.restoreAll();
      st.mock.method(Comment, 'count', async () => { throw new Error('Falha controlada ao montar a resposta'); });
      response = await call(owner.id, '/api/posts', 'POST', imageForm());
      assert.equal(response.status, 500); await response.text();
      assert.equal(await Post.count(), count); assert.deepEqual(await files(managed), before);
    });
    await t.test('a exclusão confirma o banco e mantém uma tarefa durável se o disco falhar', async (st) => {
      const { owner } = await seed();
      let response = await call(owner.id, '/api/posts', 'POST', imageForm());
      assert.equal(response.status, 201); const post = await response.json(); await exists(post.image);
      const failing = createImageMaintenance({ remove: async () => { throw Object.assign(new Error('Disco indisponível'), { code: 'EACCES' }); } });
      st.mock.method(imageMaintenance, 'processPending', () => failing.processPending());
      response = await call(owner.id, '/api/posts/' + post.id, 'DELETE');
      assert.equal(response.status, 200); await response.json();
      assert.equal(await Post.findByPk(post.id), null); await exists(post.image);
      assert.equal(await queueCount(), 1);
      const [jobs] = await database.query('SELECT attempts,lastError FROM file_cleanup_jobs');
      assert.equal((jobs as Array<{ attempts: number }>)[0].attempts, 1);
      st.mock.restoreAll();
      await database.query('UPDATE file_cleanup_jobs SET availableAt=NOW()');
      await createImageMaintenance().processPending();
      await assert.rejects(exists(post.image), { code: 'ENOENT' }); assert.equal(await queueCount(), 0);
    });
    await t.test('uma imagem ainda referenciada fica preservada até a última exclusão', async () => {
      const { owner } = await seed();
      const response = await call(owner.id, '/api/posts', 'POST', imageForm()); const post = await response.json();
      const shared = await Post.create({ userId: owner.id, content: 'Outra referência', image: post.image });
      let removed = await call(owner.id, '/api/posts/' + post.id, 'DELETE'); assert.equal(removed.status, 200); await removed.json();
      await exists(post.image); assert.equal(await queueCount(), 1);
      removed = await call(owner.id, '/api/posts/' + shared.id, 'DELETE'); assert.equal(removed.status, 200); await removed.json();
      await assert.rejects(exists(post.image), { code: 'ENOENT' }); assert.equal(await queueCount(), 0);
    });
    await t.test('perfil: falha no banco preserva as imagens antigas e alterações paralelas não perdem campos', async (st) => {
      const { owner } = await seed();
      let response = await call(owner.id, '/api/auth/profile', 'PUT', { avatar: dataUrl, cover: dataUrl });
      assert.equal(response.status, 200); const original = (await response.json()).user;
      const before = await files(managed);
      const originalSave = User.prototype.save;
      st.mock.method(User.prototype, 'save', async function(this: InstanceType<typeof User>, ...args: Parameters<typeof originalSave>) { if (this.id === owner.id) throw new Error('Falha controlada no perfil'); return originalSave.apply(this, args); });
      response = await call(owner.id, '/api/auth/profile', 'PUT', { avatar: dataUrl, cover: dataUrl });
      assert.equal(response.status, 500); await response.text();
      assert.equal((await User.findByPk(owner.id))!.avatar, original.avatar);
      assert.equal((await User.findByPk(owner.id))!.cover, original.cover);
      assert.deepEqual(await files(managed), before); assert.equal(await queueCount(), 0);
      st.mock.restoreAll();
      const rename = fs.rename;
      let writes = 0;
      st.mock.method(fs, 'rename', async (...args: Parameters<typeof rename>) => {
        if (++writes === 2) throw Object.assign(new Error('Falha controlada no disco'), { code: 'EIO' });
        return rename(...args);
      });
      response = await call(owner.id, '/api/auth/profile', 'PUT', { avatar: dataUrl, cover: dataUrl });
      assert.equal(response.status, 500); await response.text();
      assert.deepEqual(await files(managed), before);
      assert.equal((await User.findByPk(owner.id))!.avatar, original.avatar);
      st.mock.restoreAll();
      const parallel = await Promise.all([call(owner.id, '/api/auth/profile', 'PUT', { bio: 'Biografia preservada' }), call(owner.id, '/api/auth/profile', 'PUT', { avatar: dataUrl })]);
      for (const item of parallel) { assert.equal(item.status, 200); await item.json(); }
      const current = (await User.findByPk(owner.id))!;
      assert.equal(current.bio, 'Biografia preservada'); assert.notEqual(current.avatar, original.avatar); assert.equal(current.cover, original.cover);
      response = await call(owner.id, '/api/auth/profile', 'PUT', { avatar: current.avatar, bio: 'URL atual aceita' }); assert.equal(response.status, 200); await response.json();
      const { actor } = await seed();
      response = await call(actor.id, '/api/auth/profile', 'PUT', { avatar: current.avatar }); assert.equal(response.status, 400); await response.text();
    });
    await t.test('resposta perdida após o commit preserva a imagem que o banco já referencia', async (st) => {
      const { owner } = await seed();
      const transaction = database.transaction.bind(database);
      st.mock.method(database, 'transaction', async (operation: Parameters<typeof database.transaction>[0]) => {
        await transaction(operation);
        throw new Error('Conexão interrompida após o commit');
      });
      const tag = 'Commit confirmado ' + randomUUID();
      const response = await call(owner.id, '/api/posts', 'POST', imageForm(tag));
      assert.equal(response.status, 500); await response.text();
      const post = await Post.findOne({ where: { userId: owner.id, content: tag } });
      assert.ok(post?.image); await exists(post.image);
      st.mock.restoreAll();
      const removed = await call(owner.id, '/api/posts/' + post.id, 'DELETE'); assert.equal(removed.status, 200); await removed.json();
    });
    await t.test('a exclusão de conta grava as tarefas junto dos dados e uma falha desfaz tudo', async (st) => {
      const { owner } = await seed();
      let response = await call(owner.id, '/api/auth/profile', 'PUT', { avatar: dataUrl, cover: dataUrl }); const profile = (await response.json()).user;
      response = await call(owner.id, '/api/posts', 'POST', imageForm()); const post = await response.json();
      st.mock.method(Message, 'destroy', async () => { throw new Error('Falha controlada nas mensagens'); });
      response = await call(owner.id, '/api/auth/delete', 'DELETE', { password });
      assert.equal(response.status, 500); await response.text();
      assert.ok(await User.findByPk(owner.id)); assert.ok(await Post.findByPk(post.id));
      await exists(profile.avatar); await exists(profile.cover); await exists(post.image); assert.equal(await queueCount(), 0);
      st.mock.restoreAll(); st.mock.method(imageMaintenance, 'processPending', async () => {});
      response = await call(owner.id, '/api/auth/delete', 'DELETE', { password }); assert.equal(response.status, 200); await response.json();
      assert.equal(await User.findByPk(owner.id), null); assert.equal(await Post.findByPk(post.id), null); assert.equal(await queueCount(), 3);
      st.mock.restoreAll(); await createImageMaintenance().processPending();
      for (const url of [profile.avatar, profile.cover, post.image]) await assert.rejects(exists(url), { code: 'ENOENT' });
      assert.equal(await queueCount(), 0);
    });
    await t.test('reconciliação após interrupção trata só arquivos próprios antigos e para sem o banco', async (st) => {
      await fs.mkdir(managed, { recursive: true }); await fs.mkdir(staging, { recursive: true });
      const orphan = randomUUID() + '.gif', recent = randomUUID() + '.gif', referenced = randomUUID() + '.gif';
      const staged = randomUUID() + '.upload', unknown = 'arquivo-preservado.txt';
      for (const name of [orphan, recent, referenced, unknown]) await fs.writeFile(path.join(managed, name), gif);
      await fs.writeFile(path.join(staging, staged), gif);
      const old = new Date(Date.now() - 25 * 3600000);
      for (const file of [path.join(managed, orphan), path.join(managed, referenced), path.join(managed, unknown), path.join(staging, staged)]) await fs.utimes(file, old, old);
      const { owner } = await seed(); await owner.update({ avatar: '/uploads/managed/' + referenced });
      st.mock.method(database, 'authenticate', async () => { throw new Error('Banco indisponível'); });
      await assert.rejects(createImageMaintenance().run());
      await fs.access(path.join(managed, orphan)); await fs.access(path.join(staging, staged));
      st.mock.restoreAll(); await createImageMaintenance().run();
      await assert.rejects(fs.access(path.join(managed, orphan)), { code: 'ENOENT' });
      await assert.rejects(fs.access(path.join(staging, staged)), { code: 'ENOENT' });
      for (const name of [recent, referenced, unknown]) await fs.access(path.join(managed, name));
      assert.equal(cleanupKey('/uploads/managed/../../fora.png'), null); assert.equal(cleanupKey('https://example.test/image.png'), null);
      await database.query("INSERT INTO file_cleanup_jobs (fileKey,attempts,availableAt,createdAt,updatedAt) VALUES ('managed:../../fora.png',0,NOW(),NOW(),NOW())");
      await createImageMaintenance().processPending();
      await fs.access(path.join(managed, unknown));
      const [jobs] = await database.query("SELECT lastError FROM file_cleanup_jobs WHERE fileKey='managed:../../fora.png'");
      assert.equal((jobs as Array<{ lastError: string }>)[0].lastError, 'INVALID_KEY');
    });
    await t.test('cópia da base local recebe apenas a nova fila e conserva o histórico anterior', { skip: !process.env.SWIFTLINE_DATABASE_SNAPSHOT }, async () => {
      const { connectForMigrations, migrateDatabase, databaseStatus, loadMigrations } = await import('../../src/infrastructure/database/migrations.js');
      const { inspectSchema, quote, rows } = await import('../../src/infrastructure/database/schema-inspection.js');
      const connection = await connectForMigrations();
      try {
        const saved = JSON.parse(await fs.readFile(process.env.SWIFTLINE_DATABASE_SNAPSHOT!, 'utf8')) as { tables: Record<string, { create: string; rows: Record<string, unknown>[]; columns: Record<string, { type: string }> }> };
        await connection.query('SET FOREIGN_KEY_CHECKS=0');
        try {
          for (const table of Object.values(await inspectSchema(connection))) await connection.query('DROP TABLE ' + quote(table.name));
          for (const table of Object.values(saved.tables)) await connection.query(table.create);
          for (const [name, table] of Object.entries(saved.tables)) for (const row of table.rows) {
            const columns = Object.keys(row);
            const values = columns.map((column) => /^(DATE|DATETIME|TIMESTAMP)/.test(table.columns[column].type) && row[column] ? new Date(String(row[column])) : row[column]);
            await connection.query(`INSERT INTO ${quote(name)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
          }
        } finally { await connection.query('SET FOREIGN_KEY_CHECKS=1'); }
        const clonedDefinitions: Record<string, string> = {};
        for (const name of Object.keys(saved.tables)) {
          const [definition] = await rows<Record<string, string>>(connection, 'SHOW CREATE TABLE ' + quote(name));
          clonedDefinitions[name] = definition['Create Table'];
        }
        assert.deepEqual(await migrateDatabase(connection, loadMigrations().slice(0, 5)), ['0005-file-cleanup.js']);
        const canonical = (data: Record<string, unknown>[]) => data.map((row) => JSON.stringify(row, Object.keys(row).sort())).sort();
        for (const [name, table] of Object.entries(saved.tables)) {
          let current = await rows<Record<string, unknown>>(connection, 'SELECT * FROM ' + quote(name));
          if (name === 'swiftline_schema_migrations') current = current.filter((row) => row.version !== '0005-file-cleanup.js');
          assert.deepEqual(canonical(current), canonical(table.rows), name);
          const [definition] = await rows<Record<string, string>>(connection, 'SHOW CREATE TABLE ' + quote(name));
          assert.equal(definition['Create Table'], clonedDefinitions[name], name);
        }
        assert.equal((await databaseStatus(connection, loadMigrations().slice(0, 5))).ready, true);
        assert.equal((await rows<{ total: number }>(connection, 'SELECT COUNT(*) AS total FROM file_cleanup_jobs'))[0].total, 0);
      } finally { await connection.end(); }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await database.close();
  }
});
