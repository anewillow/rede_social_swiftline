import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(
  new URL('../src/app.ts', import.meta.url),
  'utf8'
);

const routeStart = appSource.indexOf("app.put('/api/auth/profile'");
const routeEnd = appSource.indexOf('\n});', routeStart);
const profileRoute = appSource.slice(routeStart, routeEnd + 4);

test('backend aceita foto de perfil enviada como Data URL', () => {
  assert.ok(
    routeStart >= 0 && routeEnd >= 0,
    'A rota de atualização do perfil não foi encontrada.'
  );

  assert.match(
    profileRoute,
    /data:image/i,
    'O backend não aceita uma imagem local no campo avatar.'
  );

  assert.match(
    profileRoute,
    /base64/i,
    'O backend não reconhece o formato Data URL.'
  );
});