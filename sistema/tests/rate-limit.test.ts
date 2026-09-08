import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { apiRateLimitOptions } from '../src/rate-limit.js';

async function requestStatus(url: string): Promise<number> {
  const response = await fetch(url);
  await response.text();
  return response.status;
}

test('limita somente as requisições feitas para a API', async () => {
  const testApp = express();
  testApp.use('/api', rateLimit({ ...apiRateLimitOptions, limit: 2 }));
  testApp.get('/api/ping', (_req, res) => res.sendStatus(200));
  testApp.get('/fora/ping', (_req, res) => res.sendStatus(200));

  const server = testApp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    assert.deepEqual([
      await requestStatus(`${baseUrl}/api/ping`),
      await requestStatus(`${baseUrl}/api/ping`),
      await requestStatus(`${baseUrl}/api/ping`),
    ], [200, 200, 429]);

    assert.deepEqual([
      await requestStatus(`${baseUrl}/fora/ping`),
      await requestStatus(`${baseUrl}/fora/ping`),
      await requestStatus(`${baseUrl}/fora/ping`),
    ], [200, 200, 200]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
