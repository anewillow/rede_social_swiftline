import assert from 'node:assert/strict';
import test from 'node:test';
import { safeImagePreview } from '../../client/utils/image-preview.js';

test('a prévia aceita somente os quatro formatos de imagem em base64', () => {
  for (const type of ['png', 'jpeg', 'gif', 'webp']) {
    const preview = `data:image/${type};base64,aW1hZ2Vt`;
    assert.equal(safeImagePreview(preview), preview);
  }
});

test('a prévia rejeita HTML, SVG, endereços externos e texto com marcação', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'https://example.test/image.png',
    'blob:https://example.test/identifier',
    'data:image/png;base64,aW1hZ2Vt" onerror="alert(1)',
    'data:image/png;base64,<svg onload=alert(1)>',
    '', null, undefined, 42, new ArrayBuffer(0),
  ]) assert.equal(safeImagePreview(value), undefined, String(value));
});

test('a prévia mantém os bytes da imagem sem reinterpretá-los como HTML', () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const preview = safeImagePreview(`data:image/png;base64,${bytes.toString('base64')}`);
  assert.ok(preview);
  assert.deepEqual(Buffer.from(preview.split(',')[1], 'base64'), bytes);
});
