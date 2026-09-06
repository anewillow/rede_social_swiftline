import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { storeAvatar } from '../src/avatar.js';

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('backend armazena foto de perfil enviada como Data URL', async () => {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'swiftline-avatar-'));

  try {
    const dataUrl = `data:image/png;base64,${onePixelPng.toString('base64')}`;
    const avatarUrl = await storeAvatar(dataUrl, tempDirectory, 42);

    assert.match(avatarUrl ?? '', /^\/uploads\/avatar-42-.+\.png$/);
    const storedFile = path.join(tempDirectory, path.basename(avatarUrl ?? ''));
    assert.equal(existsSync(storedFile), true);
    assert.deepEqual(readFileSync(storedFile), onePixelPng);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('backend mantém uma URL de avatar já armazenada', async () => {
  const avatarUrl = '/uploads/avatar-42-existente.png';
  assert.equal(await storeAvatar(avatarUrl, 'diretorio-nao-utilizado', 42), avatarUrl);
});

test('backend rejeita conteúdo que não corresponde a uma imagem', async () => {
  const fakeImage = Buffer.from('isto-nao-e-uma-imagem');
  const dataUrl = `data:image/png;base64,${fakeImage.toString('base64')}`;
  assert.equal(await storeAvatar(dataUrl, 'diretorio-nao-utilizado', 42), null);
});
