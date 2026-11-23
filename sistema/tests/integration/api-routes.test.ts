import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { User, Post, Comment, Message } from '../../src/models/index.js';
import { secret } from '../../src/middleware/auth.js';
import { TaylorNewsService } from '../../src/services/news-service.js';

let server: Server;
let baseUrl: string;
const authorization = () => ({ Authorization: 'Bearer ' + jwt.sign({ id: 7 }, secret()) });

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = 'http://127.0.0.1:' + address.port;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('as rotas privadas mantêm a exigência de login', async () => {
  for (const [method, url] of [
    ['GET', '/api/auth/me'], ['GET', '/api/posts/saved'],
    ['GET', '/api/messages/people'], ['GET', '/api/notifications'],
    ['POST', '/api/posts'], ['POST', '/api/posts/1/poll-vote'],
    ['PUT', '/api/posts/comments/1'], ['DELETE', '/api/auth/delete'],
  ]) {
    const response = await fetch(baseUrl + url, { method });
    assert.equal(response.status, 401, method + ' ' + url);
    assert.deepEqual(await response.json(), { error: 'Token ausente' });
  }
});

test('o cadastro preserva a validação dos termos e da senha', async () => {
  const send = (body: object) => fetch(baseUrl + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const withoutTerms = await send({ username: 'ane', email: 'ane@example.com', password: 'senha!123' });
  assert.equal(withoutTerms.status, 400);
  assert.match((await withoutTerms.json()).message, /aceitar os Termos/);
  const weakPassword = await send({ username: 'ane', email: 'ane@example.com', password: '123', acceptedTerms: true });
  assert.equal(weakPassword.status, 400);
  assert.match((await weakPassword.json()).message, /Senha fraca/);
});

test('o login retorna token e dados públicos e privados sem expor a senha', async (t) => {
  const user = User.build({ id: 7, username: 'ane', email: 'ane@example.com', password: await bcrypt.hash('senha!123', 4) });
  t.mock.method(User, 'findOne', async () => user);
  const response = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ane@example.com', password: 'senha!123' }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.user.id, 7);
  assert.equal(result.user.email, 'ane@example.com');
  assert.equal(result.user.password, undefined);
  assert.equal((jwt.verify(result.token, secret()) as jwt.JwtPayload).id, 7);
});

test('o controlador repassa o usuário autenticado para o serviço', async (t) => {
  const user = User.build({ id: 7, username: 'ane', email: 'ane@example.com' });
  const find = t.mock.method(User, 'findByPk', async () => user);
  const response = await fetch(baseUrl + '/api/auth/me', { headers: authorization() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).username, 'ane');
  assert.equal(find.mock.calls[0].arguments[0], 7);
});

test('a publicação rejeita enquetes inválidas antes de gravar dados', async () => {
  const response = await fetch(baseUrl + '/api/posts', {
    method: 'POST', headers: { ...authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Uma pergunta', pollOptions: JSON.stringify(['Uma opção']) }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /2 a 4/);
});

test('a edição de publicação e comentário continua restrita ao autor', async (t) => {
  t.mock.method(Post, 'findByPk', async () => Post.build({ id: 3, userId: 8, content: 'Original' }));
  t.mock.method(Comment, 'findByPk', async () => Comment.build({ id: 2, userId: 8, content: 'Original' }));
  for (const url of ['/api/posts/3', '/api/posts/comments/2']) {
    const response = await fetch(baseUrl + url, {
      method: 'PUT', headers: { ...authorization(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Alterado' }),
    });
    assert.equal(response.status, 403);
    await response.json();
  }
});

test('a busca de destinatários alcança a rota people, antes da rota de conversa', async (t) => {
  t.mock.method(User, 'findAll', async () => []);
  const conversation = t.mock.method(Message, 'findAll', async () => []);
  const response = await fetch(baseUrl + '/api/messages/people?q=ane', { headers: authorization() });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.equal(conversation.mock.callCount(), 0);
});

test('uma falha no serviço de notícias preserva a resposta de indisponibilidade', async (t) => {
  t.mock.method(TaylorNewsService.prototype, 'getLatestNews', async () => { throw new Error('Serviço indisponível no teste'); });
  const response = await fetch(baseUrl + '/api/news');
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.deepEqual(result.news, []);
  assert.match(result.error, /temporariamente/);
});

test('a interface compilada continua disponível nos endereços das telas', async () => {
  for (const url of ['/login.html', '/feed.html', '/messages.html', '/profile.html?user=ane']) {
    const response = await fetch(baseUrl + url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await response.text(), /id="root"/);
  }
});
