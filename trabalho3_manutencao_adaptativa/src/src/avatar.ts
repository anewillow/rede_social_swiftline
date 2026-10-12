import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const maxProfileImageBytes = 3 * 1024 * 1024;
const dataUrlPattern = /^data:image\/(png|jpeg|gif|webp);base64,([a-z0-9+/]+={0,2})$/i;
const remoteImagePattern = /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i;
const storedImagePattern = /^\/uploads\/[a-z0-9._-]+$/i;

type ProfileImageKind = 'avatar' | 'cover';

export type PreparedProfileImage = {
  bytes?: Buffer;
  fileName?: string;
  url: string;
};

function detectedExtension(bytes: Buffer): 'png' | 'jpg' | 'gif' | 'webp' | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return 'jpg';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function prepareProfileImage(value: string, userId: number, kind: ProfileImageKind): PreparedProfileImage | null {
  if (remoteImagePattern.test(value) || storedImagePattern.test(value)) return { url: value };

  const match = value.match(dataUrlPattern);
  if (!match) return null;

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maxProfileImageBytes) return null;

  const declaredExtension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const extension = detectedExtension(bytes);
  if (!extension || extension !== declaredExtension) return null;

  const fileName = `${kind}-${userId}-${randomUUID()}.${extension}`;
  return { bytes, fileName, url: `/uploads/${fileName}` };
}

export function prepareAvatar(value: string, userId: number): PreparedProfileImage | null {
  return prepareProfileImage(value, userId, 'avatar');
}

export function prepareCover(value: string, userId: number): PreparedProfileImage | null {
  return prepareProfileImage(value, userId, 'cover');
}

export async function savePreparedProfileImage(image: PreparedProfileImage, uploadsPath: string): Promise<string> {
  if (!image.bytes || !image.fileName) return image.url;
  await mkdir(uploadsPath, { recursive: true });
  await writeFile(path.join(uploadsPath, image.fileName), image.bytes);
  return image.url;
}

export async function removeStoredProfileImage(value: string | null, uploadsPath: string, userId: number, kind: ProfileImageKind): Promise<void> {
  if (!value) return;
  const fileName = path.basename(value);
  const expectedName = new RegExp(`^${kind}-${userId}-[0-9a-f-]+\\.(png|jpg|gif|webp)$`, 'i');
  if (!expectedName.test(fileName) || value !== `/uploads/${fileName}`) return;

  try {
    await unlink(path.join(uploadsPath, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function storeAvatar(value: string, uploadsPath: string, userId: number): Promise<string | null> {
  const image = prepareAvatar(value, userId);
  return image ? savePreparedProfileImage(image, uploadsPath) : null;
}

export async function storeCover(value: string, uploadsPath: string, userId: number): Promise<string | null> {
  const image = prepareCover(value, userId);
  return image ? savePreparedProfileImage(image, uploadsPath) : null;
}
