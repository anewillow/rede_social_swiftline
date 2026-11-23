import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePostAuthors } from '../../src/modules/posts/public.js';
import type { AuthorDirectory } from '../../src/modules/accounts/public.js';
import { Post } from '../../src/models/index.js';

test('publicações usam o perfil atual e consultam cada autor uma única vez no lote', async () => {
  let requests = 0;
  const original = [
    { id: 1, userId: 7, author: 'cópia antiga', avatar: 'foto-antiga.png', content: 'Primeira' },
    { id: 2, userId: 8, author: 'outra cópia', avatar: 'outra.png', content: 'Segunda' },
    { id: 3, userId: 7, author: 'cópia antiga', avatar: 'foto-antiga.png', content: 'Terceira' },
  ];
  const snapshot = structuredClone(original);
  const directory: AuthorDirectory = {
    async findByIds(ids) {
      requests++;
      assert.deepEqual(ids, [7, 8]);
      return [{ id: 8, username: 'Outra pessoa', avatar: null }, { id: 7, username: 'Nome atual', avatar: 'foto-atual.png' }];
    },
    async findIdsByName() { return []; },
  };
  const result = await resolvePostAuthors(original, directory);
  assert.equal(requests, 1);
  assert.deepEqual(result.map((post) => [post.id, post.author, post.avatar]), [
    [1, 'Nome atual', 'foto-atual.png'], [2, 'Outra pessoa', null], [3, 'Nome atual', 'foto-atual.png'],
  ]);
  assert.deepEqual(original, snapshot);
});

test('uma nova leitura reflete a troca do perfil sem modificar publicações', async () => {
  const posts = [{ id: 1, userId: 7, content: 'Publicação preservada' }];
  let username = 'Nome anterior';
  const directory: AuthorDirectory = {
    async findByIds() { return [{ id: 7, username, avatar: null }]; },
    async findIdsByName() { return []; },
  };
  assert.equal((await resolvePostAuthors(posts, directory))[0].author, 'Nome anterior');
  username = 'Nome atual';
  assert.equal((await resolvePostAuthors(posts, directory))[0].author, 'Nome atual');
  assert.deepEqual(posts, [{ id: 1, userId: 7, content: 'Publicação preservada' }]);
});

test('uma referência inválida não expõe cópias antigas nem quebra a listagem', async () => {
  const result = await resolvePostAuthors([{ userId: 99, author: 'cópia antiga', avatar: 'antiga.png' }], {
    async findByIds() { return []; }, async findIdsByName() { return []; },
  });
  assert.equal(result[0].author, 'Usuário indisponível');
  assert.equal(result[0].avatar, null);
});

test('uma lista vazia não consulta autores', async () => {
  assert.deepEqual(await resolvePostAuthors([], {
    async findByIds() { throw new Error('Não deve consultar'); }, async findIdsByName() { return []; },
  }), []);
});

test('o modelo persistido da publicação não possui nome nem foto do autor', () => {
  assert.equal(Post.getAttributes().author, undefined);
  assert.equal(Post.getAttributes().avatar, undefined);
  assert.ok(Post.getAttributes().userId);
});
