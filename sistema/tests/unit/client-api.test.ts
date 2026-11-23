import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authApi } from '../../client/services/auth-api.js';
import { postsApi } from '../../client/services/posts-api.js';
import { usersApi } from '../../client/services/users-api.js';
import { messagesApi } from '../../client/services/messages-api.js';
import { commentsApi } from '../../client/services/comments-api.js';
import { ApiError, request, SESSION_INVALID_EVENT } from '../../client/shared/api.js';
import { decodePage, decodePost, validateInput, LIMITS } from '../../shared/contracts/index.js';

const user = { id: 1, username: 'Ane', avatar: null };
const post = { id: 8, userId: 1, author: 'Ane', content: 'Olá', createdAt: null };
const comment = { id: 4, userId: 1, content: 'Novo texto', createdAt: '2026-11-21T00:00:00.000Z', permissions: { canEdit: true, canDelete: true } };
test('contratos da interface: dados validados, falhas, sessão e cancelamento', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalDispatch = Object.getOwnPropertyDescriptor(globalThis, 'dispatchEvent');
  const storage = new Map([['token', 'token-local'], ['user', JSON.stringify(user)]]);
  const events: string[] = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
  Object.defineProperty(globalThis, 'dispatchEvent', { configurable: true, value: (event: Event) => { events.push(event.type); return true; } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage');
    if (originalDispatch) Object.defineProperty(globalThis, 'dispatchEvent', originalDispatch); else Reflect.deleteProperty(globalThis, 'dispatchEvent');
  });
  const calls: Array<{ url: string; options: RequestInit }> = [];
  let result: unknown = {}, status = 200, html = false;
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options: RequestInit = {}) => {
    calls.push({ url: String(url), options });
    return new Response(html ? '<html>Falha</html>' : JSON.stringify(result), { status, headers: { 'Content-Type': html ? 'text/html' : 'application/json' } });
  });
  await t.test('login v2 envia JSON sem token antigo e devolve dados públicos', async () => {
    result = { token: 'nova', user };
    assert.deepEqual(await authApi.login({ email: 'ane@example.test', password: 'senha' }), result);
    const call = calls.at(-1)!; assert.equal(call.url, '/api/v2/auth/login');
    assert.equal(new Headers(call.options.headers).get('Authorization'), null);
    assert.deepEqual(JSON.parse(String(call.options.body)), { email: 'ane@example.test', password: 'senha' });
  });
  await t.test('publicar preserva FormData e valida a publicação recebida', async () => {
    result = post; const body = new FormData(); body.set('content', 'Olá'); body.set('image', new Blob(['imagem'], { type: 'image/png' }), 'imagem.png');
    assert.deepEqual(await postsApi.create(body), post); const call = calls.at(-1)!;
    assert.equal(call.url, '/api/v2/posts'); assert.equal(call.options.body, body);
    assert.equal(new Headers(call.options.headers).get('Content-Type'), null);
    assert.equal(new Headers(call.options.headers).get('Authorization'), 'Bearer token-local');
  });
  await t.test('enquete e comentário validam seus resultados antes da tela', async () => {
    result = { post }; await postsApi.updatePoll(8, { question: 'Qual?', options: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }] });
    assert.equal(calls.at(-1)!.url, '/api/v2/posts/8/poll'); assert.equal(calls.at(-1)!.options.method, 'PUT');
    result = comment; assert.deepEqual(await commentsApi.update(4, { content: 'Novo texto' }), comment);
    assert.equal(calls.at(-1)!.url, '/api/v2/posts/comments/4');
  });
  await t.test('seguir envia estado desejado e nome codificado', async () => {
    result = { success: true, following: true, followersCount: 2 }; await usersApi.setFollowing('Ane Silva', true, 2);
    const call = calls.at(-1)!; assert.equal(call.url, '/api/v2/follow/follow/Ane%20Silva');
    assert.deepEqual(JSON.parse(String(call.options.body)), { following: true });
  });
  await t.test('listagem entrega página e encaminha cancelamento ao transporte', async () => {
    result = { items: [user], nextCursor: null }; const controller = new AbortController();
    const data = await messagesApi.searchPeople('Ane Silva', controller.signal);
    assert.deepEqual(data.items, [user]); assert.ok(calls.at(-1)!.url.includes('/api/v2/messages/people?q=Ane'));
    const sent = calls.at(-1)!.options.signal!; assert.equal(sent.aborted, false); controller.abort();
    // A requisição já concluída remove o ouvinte; o transporte não mantém recursos pendurados.
  });
  await t.test('objeto de erro ou item incompleto não passa por lista válida', async () => {
    for (const bad of [{ error: 'falha' }, { items: [{ id: 1 }], nextCursor: null }, { items: [], nextCursor: 7 }]) {
      result = bad; await assert.rejects(request('/api/v2/posts', decodePage(decodePost)), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE');
    }
  });
  await t.test('HTML inesperado e JSON de erro inválido resultam em falha controlada', async () => {
    html = true; status = 502; await assert.rejects(postsApi.list(), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE');
    html = false; result = { error: 'SQL privado' }; await assert.rejects(postsApi.list(), (error: unknown) => error instanceof ApiError && !error.message.includes('SQL'));
  });
  await t.test('senha incorreta preserva a sessão; sessão inválida limpa credenciais', async () => {
    status = 401; result = { error: { code: 'INVALID_CREDENTIALS', message: 'Senha incorreta.' }, requestId: 'teste-1' };
    await assert.rejects(authApi.deleteAccount({ password: 'errada' }), ApiError); assert.equal(storage.get('token'), 'token-local');
    result = { error: { code: 'SESSION_INVALID', message: 'Entre novamente.' }, requestId: 'teste-2' };
    await assert.rejects(authApi.getCurrentUser(), ApiError); assert.equal(storage.has('token'), false); assert.ok(events.includes(SESSION_INVALID_EVENT));
  });
  await t.test('falha antiga de outra sessão não apaga o novo login', async (st) => {
    storage.set('token', 'sessao-A');
    st.mock.method(globalThis, 'fetch', async () => { storage.set('token', 'sessao-B'); return Response.json({ error: { code: 'SESSION_INVALID', message: 'Expirada' }, requestId: 'antiga' }, { status: 401 }); });
    await assert.rejects(authApi.getCurrentUser(), ApiError); assert.equal(storage.get('token'), 'sessao-B');
  });
  await t.test('cancelamento mantém AbortError e queda de rede permite tentativa explícita', async (st) => {
    st.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(new DOMException('Cancelada', 'AbortError')), { once: true })));
    const controller = new AbortController(); const pending = postsApi.list(false, controller.signal); controller.abort();
    await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === 'AbortError');
    st.mock.restoreAll(); st.mock.method(globalThis, 'fetch', async () => { throw new TypeError('rede'); });
    await assert.rejects(postsApi.list(), (error: unknown) => error instanceof ApiError && error.code === 'NETWORK_ERROR');
  });
});
test('limites e validação comuns impedem divergência entre criar e editar', () => {
  const value = '😀'.repeat(LIMITS.post);
  for (const operation of ['createPost', 'updatePost']) {
    assert.equal(validateInput(operation, { content: '  ' + value + '  ' }, {}).content, value);
    assert.throws(() => validateInput(operation, { content: value + 'x' }, {}));
  }
  assert.throws(() => validateInput('toggleLike', { liked: 'true' }, { id: '1' }));
  assert.throws(() => validateInput('sendMessage', { content: { malicious: true } }, { userId: 1 }));
  assert.throws(() => validateInput('updateProfile', { website: 'javascript:alert(1)' }, {}));
  assert.throws(() => validateInput('getPost', {}, { id: '1 OR 1=1' }));
});
