import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { storeCover } from '../src/avatar.js';

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('backend armazena imagem de capa enviada como Data URL', async () => {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'swiftline-cover-'));

  try {
    const dataUrl = `data:image/png;base64,${onePixelPng.toString('base64')}`;
    const coverUrl = await storeCover(dataUrl, tempDirectory, 42);

    assert.match(coverUrl ?? '', /^\/uploads\/cover-42-.+\.png$/);
    const storedFile = path.join(tempDirectory, path.basename(coverUrl ?? ''));
    assert.equal(existsSync(storedFile), true);
    assert.deepEqual(readFileSync(storedFile), onePixelPng);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
