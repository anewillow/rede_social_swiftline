import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Transaction } from 'sequelize';
import app from '../../src/app.js';
import database from '../../src/config/database.js';
import { User, Post, Comment, CommentLike, Like, Repost, SavedPost, PostView, PollVote, PollOption, Follow, Message, Notification } from '../../src/models/index.js';
import { secret } from '../../src/middleware/auth.js';
import { imageMaintenance } from '../../src/infrastructure/storage/file-cleanup.js';

let server: Server;
let baseUrl: string;
let hash: string;
before(async () => {
  hash = await bcrypt.hash('senha-de-teste', 4);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = 'http://127.0.0.1:' + address.port;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

async function request(body: object, authenticated = true) {
  return fetch(baseUrl + '/api/auth/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { Authorization: 'Bearer ' + jwt.sign({ id: 7 }, secret()) } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('a exclusão preserva as respostas de autenticação, conta ausente e confirmação de senha', async (t) => {
  const transaction = t.mock.method(database, 'transaction', async () => { throw new Error('Não deve gravar'); });
  t.mock.method(User, 'findByPk', async () => null);
  let response = await request({}, false);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Token ausente' });
  response = await request({ password: 'senha-de-teste' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Usuário não encontrado.' });

  t.mock.method(User, 'findByPk', async () => User.build({ id: 7, password: hash }));
  response = await request({});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Digite sua senha para confirmar a exclusão.' });
  response = await request({ password: 'incorreta' });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Senha incorreta.' });
  assert.equal(transaction.mock.callCount(), 0);
});

test('a rota executa o coordenador e todos os repositórios recebem a mesma transação', async (t) => {
  t.mock.method(imageMaintenance, 'processPending', async () => {});
  const transaction = { LOCK: { UPDATE: 'UPDATE' } } as Transaction;
  let confirmed = false;
  const writes: string[] = [];
  t.mock.method(database, 'transaction', async (operation: (value: Transaction) => Promise<void>) => {
    await operation(transaction);
    confirmed = true;
  });
  t.mock.method(User, 'findByPk', async () => User.build({ id: 7, password: hash, avatar: null, cover: null }));
  t.mock.method(Post, 'findAll', async (options: { transaction?: Transaction }) => { assert.equal(options.transaction, transaction); return [Post.build({ id: 30, userId: 7 })]; });
  t.mock.method(Comment, 'findAll', async (options: { transaction?: Transaction }) => { assert.equal(options.transaction, transaction); return [Comment.build({ id: 40, userId: 7 })]; });
  for (const model of [CommentLike, Like, Repost, SavedPost, PostView, PollVote, PollOption, Comment, Post, Follow, Message, Notification, User]) {
    t.mock.method(model, 'destroy', async (options: { transaction?: Transaction }) => {
      assert.equal(options.transaction, transaction);
      writes.push(model.name);
      return 1;
    });
  }
  const response = await request({ password: 'senha-de-teste' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Conta excluída com sucesso.' });
  assert.equal(confirmed, true);
  assert.equal(writes.length, 13);
  assert.equal(writes.at(-1), 'User');
  assert.ok(writes.indexOf('PollVote') < writes.indexOf('PollOption'));
});
