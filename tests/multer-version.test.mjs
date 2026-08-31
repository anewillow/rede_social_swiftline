import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageLock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
);

const multerVersion = packageLock.packages?.['node_modules/multer']?.version;

const isAtLeast = (currentVersion, minimumVersion) => {
  const current = currentVersion.split('-')[0].split('.').map(Number);
  const minimum = minimumVersion.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }

  return true;
};

test('usa Multer 2.2.0 ou superior', () => {
  assert.ok(multerVersion, 'A versão instalada do Multer não foi encontrada.');
  assert.ok(
    isAtLeast(multerVersion, '2.2.0'),
    `Versão vulnerável do Multer encontrada: ${multerVersion}. Esperado: 2.2.0 ou superior.`
  );
});
