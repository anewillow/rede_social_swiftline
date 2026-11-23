import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const client = path.resolve(__dirname, '../../../client');

test('feed, perfil e salvos usam a entrada pública da funcionalidade e o mesmo PostCard', () => {
  for (const name of ['Feed', 'SwiftProfile', 'SavedPosts']) {
    const source = fs.readFileSync(path.join(client, 'pages', name + '.tsx'), 'utf8');
    assert.match(source, /from ['"]\.\.\/features\/posts['"]/);
    assert.match(source, /<PostCard\b/);
    assert.doesNotMatch(source, /<article\b|PostActions|PostPoll|PostOwnerControls|setPosts/);
  }
  for (const file of ['ProfileComments.tsx', 'ProfilePostActions.tsx'])
    assert.equal(fs.existsSync(path.join(client, 'components/profile', file)), false);
  assert.match(fs.readFileSync(path.join(client, 'App.tsx'), 'utf8'), /<PostsProvider key=\{user\.id\}/);
});
