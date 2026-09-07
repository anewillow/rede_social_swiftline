import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeleteComment,
  canDeletePost,
  canEditComment,
  getCommentPermissions,
} from '../src/permissions.js';

test('o autor mantém as permissões atuais', () => {
  assert.equal(canDeletePost(7, 7), true);
  assert.equal(canEditComment(7, 7), true);
  assert.equal(canDeleteComment(7, 7), true);
  assert.deepEqual(getCommentPermissions(7, 7), {
    canEdit: true,
    canDelete: true,
  });
});

test('outro usuário continua sem permissão sobre conteúdo alheio', () => {
  assert.equal(canDeletePost(8, 7), false);
  assert.equal(canEditComment(8, 7), false);
  assert.equal(canDeleteComment(8, 7), false);
  assert.deepEqual(getCommentPermissions(8, 7), {
    canEdit: false,
    canDelete: false,
  });
});

test('um visitante não recebe permissões de comentário', () => {
  assert.equal(canDeletePost(undefined, 7), false);
  assert.equal(canEditComment(undefined, 7), false);
  assert.equal(canDeleteComment(undefined, 7), false);
  assert.deepEqual(getCommentPermissions(undefined, 7), {
    canEdit: false,
    canDelete: false,
  });
});
