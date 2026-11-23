import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Post } from '../../client/types/index.js';
import { emptyPostState, postStateReducer, selectPostList } from '../../client/features/posts/post-state.js';

const post: Post = { id: 10, userId: 7, author: 'Ane', content: 'Texto original', createdAt: '2026-11-21T10:00:00Z', liked: false, likes: 0, saved: true };
function threeLists() {
  let state = emptyPostState();
  for (const key of ['feed:false', 'user:Ane', 'saved']) state = postStateReducer(state, { type: 'replace-list', key, posts: [post], startedAt: state.revision });
  return state;
}

test('curtida e edição alteram a mesma publicação nas três listas', () => {
  const before = threeLists();
  const state = postStateReducer(before, { type: 'patch', id: 10, patch: { liked: true, likes: 1, content: 'Texto alterado' } });
  for (const key of ['feed:false', 'user:Ane', 'saved']) {
    assert.equal(selectPostList(state, key)[0], state.entities[10]);
    assert.equal(selectPostList(state, key)[0].content, 'Texto alterado');
    assert.equal(selectPostList(state, key)[0].liked, true);
  }
  assert.equal(before.entities[10].content, 'Texto original');
});

test('remover dos salvos não remove a publicação do feed ou do perfil', () => {
  const state = postStateReducer(threeLists(), { type: 'patch', id: 10, patch: { saved: false } });
  assert.deepEqual(selectPostList(state, 'saved'), []);
  assert.equal(selectPostList(state, 'feed:false').length, 1);
  assert.equal(selectPostList(state, 'user:Ane')[0].saved, false);
});

test('a exclusão remove a publicação de todas as listas e uma resposta atrasada não a recria', () => {
  let state = postStateReducer(threeLists(), { type: 'remove', id: 10 });
  state = postStateReducer(state, { type: 'replace-list', key: 'saved', posts: [post], startedAt: 0 });
  for (const key of ['feed:false', 'user:Ane', 'saved']) assert.deepEqual(selectPostList(state, key), []);
  assert.equal(state.entities[10], undefined);
});

test('uma leitura iniciada antes da interação não desfaz a curtida nem a remoção dos salvos', () => {
  let state = threeLists();
  const startedAt = state.revision;
  state = postStateReducer(state, { type: 'patch', id: 10, patch: { liked: true, likes: 1, saved: false } });
  state = postStateReducer(state, { type: 'replace-list', key: 'saved', posts: [post], startedAt });
  assert.deepEqual(selectPostList(state, 'saved'), []);
  assert.equal(state.entities[10].liked, true);
  assert.equal(state.entities[10].likes, 1);
});

test('as listas mantêm sua ordem e remover a enquete preserva a publicação', () => {
  let state = emptyPostState();
  state = postStateReducer(state, { type: 'replace-list', key: 'saved', posts: [{ ...post, id: 12 }, post, { ...post, id: 12 }], startedAt: 0 });
  state = postStateReducer(state, { type: 'patch', id: 10, patch: { poll: null } });
  assert.deepEqual(selectPostList(state, 'saved').map((item) => item.id), [12, 10]);
  assert.equal(state.entities[10].content, post.content);
  assert.equal(state.entities[10].poll, null);
});
