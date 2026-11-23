import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler } from 'express';
import { stagedUploadsPath } from '../config/paths.js';

class UnsupportedUpload extends Error {}
const stagedFiles = new WeakMap<Request, string>();
mkdirSync(stagedUploadsPath, { recursive: true });
const receive = multer({
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_request, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimetype)) callback(new UnsupportedUpload());
    else callback(null, true);
  },
  storage: multer.diskStorage({
    destination: stagedUploadsPath,
    filename: (request, _file, callback) => {
      const filename = randomUUID() + '.upload';
      stagedFiles.set(request, path.join(stagedUploadsPath, filename));
      callback(null, filename);
    },
  }),
}).single('image');

export const receivePostImage: RequestHandler = (req, res, next) => {
  receive(req, res, (error) => {
    const cleanup = () => {
      const stagedFile = stagedFiles.get(req);
      if (!stagedFile) return;
      stagedFiles.delete(req);
      void unlink(stagedFile).catch(() => {});
    };
    res.once('finish', cleanup); res.once('close', cleanup);
    if (error instanceof UnsupportedUpload) { cleanup(); res.status(415).json({ message: 'Selecione uma imagem PNG, JPEG, GIF ou WebP.' }); return; }
    if (error instanceof multer.MulterError) { cleanup(); res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 3 MB.' : 'Envio de imagem inválido.' }); return; }
    if (error) { cleanup(); next(error); return; }
    next();
  });
};
