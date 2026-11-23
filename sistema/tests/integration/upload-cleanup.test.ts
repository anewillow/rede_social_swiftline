import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import express from 'express';
import { stagedUploadsPath } from '../../src/config/paths.js';
import { receivePostImage } from '../../src/middleware/upload.js';

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function exists(filename: string): Promise<boolean> {
  return access(filename).then(() => true, () => false);
}

async function waitForRemoval(filename: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (await exists(filename) && Date.now() < deadline) await setTimeout(10);
  assert.equal(await exists(filename), false, 'O arquivo recebido deve ser removido.');
}

async function uploadAndFinish(replacementPath?: string): Promise<void> {
  let receivedFile: string | undefined;
  const app = express();
  app.post('/upload', receivePostImage, (req, res) => {
    assert.ok(req.file);
    receivedFile = req.file.path;
    if (replacementPath) req.file.path = replacementPath;
    res.json({ received: true });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const form = new FormData();
    form.set('image', new Blob([onePixelPng], { type: 'image/png' }), 'preview.png');
    const response = await fetch(`http://127.0.0.1:${address.port}/upload`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    assert.ok(receivedFile);
    await waitForRemoval(receivedFile);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    if (receivedFile) await unlink(receivedFile).catch(() => {});
  }
}

test('remove o arquivo temporário gerado para a própria solicitação', async () => {
  await uploadAndFinish();
});

test('preserva outro arquivo da pasta temporária mesmo se os metadados forem alterados', async () => {
  const sentinel = path.join(stagedUploadsPath, randomUUID() + '.upload');
  await writeFile(sentinel, 'preservar');
  try {
    await uploadAndFinish(sentinel);
    assert.equal(await readFile(sentinel, 'utf8'), 'preservar');
  } finally {
    await unlink(sentinel).catch(() => {});
  }
});

test('preserva arquivos fora da pasta temporária se os metadados forem alterados', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'swiftline-upload-test-'));
  const sentinel = path.join(directory, 'preservar.txt');
  await writeFile(sentinel, 'preservar');
  try {
    await uploadAndFinish(sentinel);
    assert.equal(await readFile(sentinel, 'utf8'), 'preservar');
  } finally {
    await unlink(sentinel).catch(() => {});
    await rmdir(directory);
  }
});
