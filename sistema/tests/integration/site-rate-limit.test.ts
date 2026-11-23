import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import app from '../../src/app.js';
import { siteRateLimitOptions } from '../../src/config/rate-limit.js';

test('limita o acesso à página e aos arquivos, além do limite específico da API', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (let index = 0; index < siteRateLimitOptions.limit; index += 1) {
      const response = await fetch(baseUrl + '/', { method: 'HEAD' });
      assert.equal(response.status, 200, `Solicitação ${index + 1}`);
    }

    for (const endpoint of ['/', '/uploads/probe.png', '/pagina-inexistente']) {
      const response = await fetch(baseUrl + endpoint);
      await response.text();
      assert.equal(response.status, 429, endpoint);
      assert.ok(response.headers.has('retry-after'));
    }

    const apiResponse = await fetch(baseUrl + '/api/v2/auth/me');
    assert.equal(apiResponse.status, 429);
    assert.equal((await apiResponse.json()).error.code, 'RATE_LIMITED');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
