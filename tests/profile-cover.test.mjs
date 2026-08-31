import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const userModel = readFileSync(
  new URL('../src/models/User.ts', import.meta.url),
  'utf8'
);

const appSource = readFileSync(
  new URL('../src/app.ts', import.meta.url),
  'utf8'
);

test('backend salva e retorna a imagem de capa do perfil', () => {
  assert.match(
    userModel,
    /declare\s+cover\s*:/,
    'O modelo User não possui o campo cover.'
  );

  assert.match(
    userModel,
    /\bcover\s*:\s*\{\s*type:\s*DataTypes\.(STRING|TEXT)/,
    'O campo cover não está configurado no banco.'
  );

  assert.match(
    appSource,
    /const\s*\{[^}]*\bcover\b[^}]*\}\s*=\s*req\.body/,
    'O backend não recebe o campo cover.'
  );

  assert.match(
    appSource,
    /user\.cover\s*=\s*cover/,
    'O backend não salva o campo cover.'
  );

  assert.match(
    appSource,
    /cover\s*:\s*user\.cover/,
    'A resposta do perfil não devolve o campo cover.'
  );
});