import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const sourceRoot = path.resolve(__dirname, '../../../src');
const owners: Record<string, string[]> = {
  accounts: ['User'],
  posts: ['Post', 'Comment', 'CommentLike', 'Like', 'Repost', 'SavedPost', 'PostView', 'PollOption', 'PollVote'],
  network: ['Follow'],
  messages: ['Message'],
  notifications: ['Notification'],
};

function imports(file: string) {
  const source = fs.readFileSync(file, 'utf8');
  const declarations = [
    ...source.matchAll(/^\s*import\s+(?:type\s+)?([^;]+?)\s+from\s+['"]([^'"]+)['"]/gm),
    ...source.matchAll(/^\s*export\s+(?:type\s+)?(\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/gm),
  ];
  return declarations.map((match) => ({
    dependency: match[2],
    names: (match[1].match(/\{([^}]*)\}/s)?.[1] ?? '').split(',')
      .map((item) => item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean),
  }));
}

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : full.endsWith('.ts') ? [full] : [];
  });
}

test('o coordenador depende das operações públicas, sem HTTP nem acesso direto a modelos', () => {
  for (const file of files(path.join(sourceRoot, 'workflows'))) {
    for (const { dependency } of imports(file)) {
      assert.ok(!/express|sequelize|models|persistence|infrastructure|bootstrap|services/.test(dependency), file + ': ' + dependency);
      if (dependency.includes('/modules/')) assert.ok(dependency.endsWith('/public.js'), dependency);
    }
  }
});

test('cada repositório de exclusão acessa somente os modelos do seu módulo', () => {
  for (const [owner, allowed] of Object.entries(owners)) {
    for (const file of files(path.join(sourceRoot, 'modules', owner))) {
      for (const { dependency, names } of imports(file)) {
        if (dependency.includes('/models/')) {
          assert.ok(file.includes(path.sep + 'persistence' + path.sep), file);
          assert.ok(names.length > 0, 'Modelos devem ser importados nominalmente');
          for (const name of names) assert.ok(allowed.includes(name), owner + ' não pode acessar ' + name);
        }
        if (!file.includes(path.sep + 'persistence' + path.sep))
          assert.ok(!/express|sequelize|node:fs/.test(dependency), file + ': ' + dependency);
        const resolved = path.resolve(path.dirname(file), dependency);
        const otherModule = path.relative(path.join(sourceRoot, 'modules'), resolved).split(path.sep)[0];
        if (Object.hasOwn(owners, otherModule) && otherModule !== owner)
          assert.ok(dependency.endsWith('/public.js'), 'Importação interna entre módulos: ' + dependency);
      }
    }
  }
});
