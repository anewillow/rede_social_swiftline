import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
const root = path.resolve(__dirname, '../../..');
function files(directory: string): string[] { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []); }
test('contratos compartilhados não dependem da interface, do HTTP ou do banco', () => {
  for (const file of files(path.join(root, 'shared/contracts'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /(?:from\s+|import\s*\()['"](?:react|express|sequelize|\.\..*(?:client|src))/i, file);
  }
});
test('telas e funcionalidades recebem dados tipados pelo transporte comum', () => {
  for (const directory of ['client/pages', 'client/components', 'client/features', 'client/services']) for (const file of files(path.join(root, directory))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\bfetch\s*\(|\.json\s*\(|\.ok\b/, file);
  }
});
