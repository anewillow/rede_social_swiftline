import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { managedUploadsPath, stagedUploadsPath } from '../../config/paths.js';
import { detectedExtension } from '../../services/profile-images-service.js';
import { activeManagedFiles, enqueueImageCleanup, imageIsReferenced } from './file-cleanup.js';

const maxBytes = 3 * 1024 * 1024;
export class InvalidImage extends Error {}
export type ManagedImage = { key: string; url: string };

export async function promoteImage(bytes: Buffer, stagedFile?: string): Promise<ManagedImage> {
  if (stagedFile && path.dirname(path.resolve(stagedFile)) !== path.resolve(stagedUploadsPath)) throw new InvalidImage('Arquivo fora da área temporária.');
  const extension = detectedExtension(bytes);
  if (!extension || !bytes.length || bytes.length > maxBytes) throw new InvalidImage('Imagem inválida ou maior que 3 MB.');
  const key = randomUUID() + '.' + extension;
  const staged = stagedFile ?? path.join(stagedUploadsPath, randomUUID() + '.upload');
  await fs.mkdir(stagedUploadsPath, { recursive: true });
  await fs.mkdir(managedUploadsPath, { recursive: true });
  activeManagedFiles.add(key);
  try {
    if (!stagedFile) await fs.writeFile(staged, bytes, { flag: 'wx' });
    await fs.rename(staged, path.join(managedUploadsPath, key));
    return { key, url: '/uploads/managed/' + key };
  } catch (error) {
    activeManagedFiles.delete(key);
    await fs.unlink(staged).catch(() => {});
    throw error;
  }
}

export async function promotePostImage(file: Express.Multer.File): Promise<ManagedImage> {
  if (path.dirname(path.resolve(file.path)) !== path.resolve(stagedUploadsPath)) throw new InvalidImage('Arquivo fora da área temporária.');
  const bytes = await fs.readFile(file.path);
  const extension = detectedExtension(bytes);
  const expected = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension;
  if (!extension || file.mimetype !== expected) throw new InvalidImage('O conteúdo não corresponde ao tipo da imagem.');
  return promoteImage(bytes, file.path);
}

export function releaseImage(image: ManagedImage | undefined): void { if (image) activeManagedFiles.delete(image.key); }
export async function discardImage(image: ManagedImage | undefined): Promise<void> {
  if (!image) return;
  try {
    if (!await imageIsReferenced(image.url)) {
      try { await fs.unlink(path.join(managedUploadsPath, image.key)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') await enqueueImageCleanup(image.url); }
    }
  } catch { /* An uncertain commit or database outage must preserve the file. */ }
  finally { releaseImage(image); }
}

export function mayKeepImageUrl(value: string, previous: string | null): boolean {
  if (value === previous) return true;
  const controlled = (url: string) => url.startsWith('/uploads/managed/') || /^\/uploads\/(avatar|cover)-\d+-/i.test(url);
  if (controlled(value)) return false;
  try { if (controlled(new URL(value).pathname)) return false; } catch {}
  return true;
}
