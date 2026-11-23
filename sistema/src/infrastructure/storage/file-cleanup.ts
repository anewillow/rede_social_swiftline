import fs from 'node:fs/promises';
import path from 'node:path';
import { Op, QueryTypes, type Transaction } from 'sequelize';
import database from '../../config/database.js';
import { uploadsPath, managedUploadsPath, stagedUploadsPath } from '../../config/paths.js';
import { Post, User } from '../../models/index.js';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const managedPattern = new RegExp('^' + uuid + '\\.(png|jpg|gif|webp)$', 'i');
const profilePattern = new RegExp('^(avatar|cover)-[1-9][0-9]*-' + uuid + '\\.(png|jpg|gif|webp)$', 'i');
const stagedPattern = new RegExp('^' + uuid + '\\.upload$', 'i');
export const activeManagedFiles = new Set<string>();

export function cleanupKey(url: string | null | undefined, owner?: { id: number; kind: 'avatar' | 'cover' }): string | null {
  if (!url) return null;
  const managed = url.startsWith('/uploads/managed/') ? url.slice('/uploads/managed/'.length) : '';
  if (managedPattern.test(managed)) return 'managed:' + managed;
  const legacy = url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : '';
  if (owner && profilePattern.test(legacy) && legacy.startsWith(owner.kind + '-' + owner.id + '-')) return 'profile:' + legacy;
  return null;
}

function location(key: string, directories: { uploads: string; managed: string }) {
  const [kind, filename, extra] = key.split(':');
  if (extra !== undefined) return null;
  if (kind === 'managed' && managedPattern.test(filename)) return { filename, file: path.join(directories.managed, filename), url: '/uploads/managed/' + filename };
  if (kind === 'profile' && profilePattern.test(filename)) return { filename, file: path.join(directories.uploads, filename), url: '/uploads/' + filename };
  return null;
}

export async function enqueueImageCleanup(url: string | null | undefined, transaction?: Transaction, owner?: { id: number; kind: 'avatar' | 'cover' }): Promise<void> {
  const key = cleanupKey(url, owner);
  if (!key) return;
  await database.query('INSERT INTO file_cleanup_jobs (fileKey,attempts,availableAt,createdAt,updatedAt) VALUES (?,0,NOW(),NOW(),NOW()) ON DUPLICATE KEY UPDATE availableAt=LEAST(availableAt,NOW()),updatedAt=NOW()', { replacements: [key], transaction });
}

export async function imageIsReferenced(url: string, transaction?: Transaction): Promise<boolean> {
  return Boolean(await Post.count({ where: { image: url }, transaction }) || await User.count({ where: { [Op.or]: [{ avatar: url }, { cover: url }] }, transaction }));
}

export function createImageMaintenance(options: {
  uploads?: string; managed?: string; staging?: string; remove?: (file: string) => Promise<void>; now?: () => number;
} = {}) {
  const directories = { uploads: options.uploads ?? uploadsPath, managed: options.managed ?? managedUploadsPath, staging: options.staging ?? stagedUploadsPath };
  const now = options.now ?? Date.now;
  const remove = options.remove ?? fs.unlink;
  let busy = false;
  async function removeFile(file: string) {
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe file type');
      await remove(file);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  async function processPending(limit = 25): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      for (let index = 0; index < limit; index++) {
        const processed = await database.transaction(async (transaction) => {
          const jobs = await database.query<{ fileKey: string; attempts: number }>('SELECT fileKey,attempts FROM file_cleanup_jobs WHERE availableAt<=NOW() ORDER BY availableAt,fileKey LIMIT 1 FOR UPDATE SKIP LOCKED', { type: QueryTypes.SELECT, transaction });
          const job = jobs[0];
          if (!job) return false;
          const target = location(job.fileKey, directories);
          if (!target) {
            await database.query("UPDATE file_cleanup_jobs SET attempts=attempts+1,availableAt=DATE_ADD(NOW(), INTERVAL ? SECOND),lastError='INVALID_KEY',updatedAt=NOW() WHERE fileKey=?", { replacements: [86400, job.fileKey], transaction });
            return true;
          }
          if (activeManagedFiles.has(target.filename) || await imageIsReferenced(target.url, transaction)) {
            await database.query('UPDATE file_cleanup_jobs SET availableAt=DATE_ADD(NOW(), INTERVAL ? SECOND),updatedAt=NOW() WHERE fileKey=?', { replacements: [3600, job.fileKey], transaction });
            return true;
          }
          try { await removeFile(target.file); }
          catch (error) {
            await database.query('UPDATE file_cleanup_jobs SET attempts=attempts+1,availableAt=DATE_ADD(NOW(), INTERVAL ? SECOND),lastError=?,updatedAt=NOW() WHERE fileKey=?', { replacements: [Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)), (error as NodeJS.ErrnoException).code ?? 'FILE_ERROR', job.fileKey], transaction });
            return true;
          }
          await database.query('DELETE FROM file_cleanup_jobs WHERE fileKey=?', { replacements: [job.fileKey], transaction });
          return true;
        });
        if (!processed) break;
      }
    } finally { busy = false; }
  }
  async function reconcile(): Promise<void> {
    await database.authenticate();
    const cutoff = now() - 24 * 3600000;
    for (const [directory, pattern, managed] of [[directories.managed, managedPattern, true], [directories.staging, stagedPattern, false]] as const) {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
      for (const entry of entries) {
        if (!entry.isFile() || !pattern.test(entry.name) || activeManagedFiles.has(entry.name)) continue;
        const file = path.join(directory, entry.name);
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.mtimeMs >= cutoff) continue;
        if (managed) {
          const url = '/uploads/managed/' + entry.name;
          if (!await imageIsReferenced(url)) await enqueueImageCleanup(url);
        } else await removeFile(file);
      }
    }
  }
  return { processPending, reconcile, async run() { await reconcile(); await processPending(); } };
}

export const imageMaintenance = createImageMaintenance();
export async function tryImageCleanup(): Promise<void> {
  try { await imageMaintenance.processPending(); }
  catch { /* Durable jobs remain for the periodic retry. */ }
}
export function startImageMaintenance(): () => void {
  const run = () => { void imageMaintenance.run().catch(() => console.error('Limpeza de imagens adiada; a próxima execução tentará novamente.')); };
  run();
  const timer = setInterval(run, 60000);
  timer.unref();
  return () => clearInterval(timer);
}
