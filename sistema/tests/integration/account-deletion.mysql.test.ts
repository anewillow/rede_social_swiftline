import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Model, ModelStatic } from 'sequelize';

test('exclusão de conta em MySQL descartável', { skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || (Boolean(process.env.SWIFTLINE_MYSQL_SUITE) && process.env.SWIFTLINE_MYSQL_SUITE !== 'account-deletion') }, async (t) => {
  // Nenhum modelo ou aplicação é carregado antes destas verificações.
  const expectedDirectory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_NAME, 'swiftline_case1_test');
  assert.ok(Number(process.env.DB_PORT) > 0);
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('swiftline-case1-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(expectedDirectory)));

  const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
  const models = await import('../../src/models/index.js');
  const { default: app } = require('../../src/app.js') as typeof import('../../src/app.js');
  const { deleteAccount } = await import('../../src/bootstrap/delete-account.js');
  const { secret } = await import('../../src/middleware/auth.js');
  const { User, Post, Comment, CommentLike, Like, Repost, SavedPost, PostView, PollOption, PollVote, Follow, Message, Notification } = models;
  const allModels = Object.values(models).filter((value) => typeof value === 'function') as ModelStatic<Model>[];
  let server: ReturnType<typeof app.listen> | undefined;
  const uploads = path.join(process.cwd(), 'public', 'uploads');
  const password = 'senha-exclusiva-do-teste';
  const hash = await bcrypt.hash(password, 4);
  let baseUrl: string;

  async function snapshot() {
    const result: Record<string, Record<string, unknown>[]> = {};
    for (const model of allModels) {
      const order = model.primaryKeyAttributes.map((key): [string, 'ASC'] => [key, 'ASC']);
      result[model.name] = (await model.findAll({ order })).map((row) => {
        const plain = JSON.parse(JSON.stringify(row.toJSON())) as Record<string, unknown>;
        delete plain.password;
        return plain;
      });
    }
    return result;
  }

  async function seed(withContent = true) {
    const tag = randomUUID().replaceAll('-', '');
    const users = await User.bulkCreate(['alvo', 'outra', 'terceira'].map((name) => ({
      username: name + tag, email: name + tag + '@example.test', password: hash,
    })));
    const [target, other, third] = users;
    const avatar = `avatar-${target.id}-${randomUUID()}.png`;
    const cover = `cover-${target.id}-${randomUUID()}.png`;
    await target.update({ avatar: '/uploads/' + avatar, cover: '/uploads/' + cover });
    await mkdir(uploads, { recursive: true });
    await writeFile(path.join(uploads, avatar), 'avatar exclusivo do teste');
    await writeFile(path.join(uploads, cover), 'capa exclusiva do teste');
    const untouched = path.join(uploads, 'arquivo-de-outra-pessoa-' + tag + '.png');
    await writeFile(untouched, 'arquivo preservado');

    if (withContent) {
      const posts = await Post.bulkCreate([
        { userId: target.id, content: 'Publicação do alvo' },
        { userId: other.id, content: 'Publicação de outra pessoa' },
      ]);
      const [ownedPost, otherPost] = posts;
      const comments = await Comment.bulkCreate([
        { userId: other.id, postId: ownedPost.id, content: 'Comentário recebido' },
        { userId: target.id, postId: otherPost.id, content: 'Comentário do alvo em outra publicação' },
        { userId: third.id, postId: otherPost.id, content: 'Comentário preservado' },
      ]);
      await CommentLike.bulkCreate([
        { userId: third.id, commentId: comments[0].id },
        { userId: other.id, commentId: comments[1].id },
        { userId: target.id, commentId: comments[2].id },
        { userId: other.id, commentId: comments[2].id },
      ]);
      for (const model of [Like, Repost, SavedPost, PostView]) {
        await model.bulkCreate([
          { userId: other.id, postId: ownedPost.id },
          { userId: target.id, postId: otherPost.id },
          { userId: third.id, postId: otherPost.id },
        ]);
      }
      const options = await PollOption.bulkCreate([
        { postId: ownedPost.id, text: 'Opção do alvo', position: 0 },
        { postId: otherPost.id, text: 'Opção de outra pessoa', position: 0 },
      ]);
      await PollVote.bulkCreate([
        { postId: ownedPost.id, optionId: options[0].id, userId: other.id },
        { postId: otherPost.id, optionId: options[1].id, userId: target.id },
        { postId: otherPost.id, optionId: options[1].id, userId: third.id },
      ]);
      await Follow.bulkCreate([
        { followerId: target.id, followingId: other.id },
        { followerId: other.id, followingId: target.id },
        { followerId: other.id, followingId: third.id },
      ]);
      await Message.bulkCreate([
        { senderId: target.id, receiverId: other.id, content: 'Enviada' },
        { senderId: other.id, receiverId: target.id, content: 'Recebida' },
        { senderId: other.id, receiverId: third.id, content: 'Preservada' },
      ]);
      await Notification.bulkCreate([
        { userId: target.id, actorId: other.id, type: 'follow', message: 'Recebida pelo alvo' },
        { userId: other.id, actorId: target.id, type: 'follow', message: 'Causada pelo alvo' },
        { userId: other.id, actorId: third.id, type: 'follow', message: 'Preservada' },
      ]);
    }
    return { userId: target.id, avatar: path.join(uploads, avatar), cover: path.join(uploads, cover), untouched };
  }

  async function request(userId: number, suppliedPassword: string) {
    return fetch(baseUrl + '/api/auth/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: userId }, secret()) },
      body: JSON.stringify({ password: suppliedPassword }),
    });
  }

  try {
    await database.authenticate();
    const [rows] = await database.query('SELECT @@datadir AS directory');
    const actualDirectory = (rows as Array<{ directory: string }>)[0].directory;
    const normalize = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    assert.equal(normalize(actualDirectory), normalize(expectedDirectory));
    // O banco foi criado vazio pelo runner e sua localização foi conferida acima.
    const { prepareMigratedTestDatabase } = await import('../helpers/prepare-migrated-database.js');
    await prepareMigratedTestDatabase();
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    baseUrl = 'http://127.0.0.1:' + address.port;

    await t.test('a rota exclui todos os dados relacionados e preserva os dados das outras pessoas', async () => {
      const fixture = await seed();
      const before = await snapshot();
      const ownedPosts = new Set(before.Post.filter((row) => row.userId === fixture.userId).map((row) => row.id));
      const removedComments = new Set(before.Comment.filter((row) => row.userId === fixture.userId || ownedPosts.has(row.postId)).map((row) => row.id));
      const keep: Record<string, (row: Record<string, unknown>) => boolean> = {
        User: (row) => row.id !== fixture.userId,
        Post: (row) => row.userId !== fixture.userId,
        Comment: (row) => !removedComments.has(row.id),
        CommentLike: (row) => row.userId !== fixture.userId && !removedComments.has(row.commentId),
        PollOption: (row) => !ownedPosts.has(row.postId),
        Follow: (row) => row.followerId !== fixture.userId && row.followingId !== fixture.userId,
        Message: (row) => row.senderId !== fixture.userId && row.receiverId !== fixture.userId,
        Notification: (row) => row.userId !== fixture.userId && row.actorId !== fixture.userId,
      };
      for (const name of ['Like', 'Repost', 'SavedPost', 'PostView', 'PollVote'])
        keep[name] = (row) => row.userId !== fixture.userId && !ownedPosts.has(row.postId);
      const response = await request(fixture.userId, password);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { message: 'Conta excluída com sucesso.' });
      const after = await snapshot();
      for (const [name, records] of Object.entries(before)) assert.deepEqual(after[name], records.filter(keep[name]), name);
      await assert.rejects(access(fixture.avatar), { code: 'ENOENT' });
      await assert.rejects(access(fixture.cover), { code: 'ENOENT' });
      assert.equal(await readFile(fixture.untouched, 'utf8'), 'arquivo preservado');
    });

    await t.test('uma falha depois de remover conteúdo e mensagens desfaz todas as alterações no banco', async (caseTest) => {
      const fixture = await seed();
      const before = await snapshot();
      const failure = new Error('Falha controlada antes de remover notificações');
      caseTest.mock.method(Notification, 'destroy', async () => { throw failure; });
      await assert.rejects(deleteAccount({ userId: fixture.userId, password }), (error) => error === failure);
      assert.deepEqual(await snapshot(), before);
      await access(fixture.avatar);
      await access(fixture.cover);
    });

    await t.test('senha incorreta não altera registros nem remove as imagens', async () => {
      const fixture = await seed();
      const before = await snapshot();
      const response = await request(fixture.userId, 'senha-incorreta');
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { message: 'Senha incorreta.' });
      assert.deepEqual(await snapshot(), before);
      await access(fixture.avatar);
      await access(fixture.cover);
    });

    await t.test('a exclusão também funciona para uma conta sem publicações ou interações', async () => {
      const fixture = await seed(false);
      const before = await snapshot();
      const response = await request(fixture.userId, password);
      assert.equal(response.status, 200);
      await response.json();
      const after = await snapshot();
      assert.deepEqual(after.User, before.User.filter((row) => row.id !== fixture.userId));
      for (const name of Object.keys(before).filter((name) => name !== 'User')) assert.deepEqual(after[name], before[name], name);
    });
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await database.close();
  }
});
