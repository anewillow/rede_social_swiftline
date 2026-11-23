import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { User } from '../models/User.js';
import { sendApiError } from '../http/api-errors.js';

const secret = () => process.env.JWT_SECRET ?? 'swiftline-development-secret';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { if (req.apiVersion === 2) sendApiError(req, res, 401, 'Entre na sua conta para continuar.', 'SESSION_INVALID'); else res.status(401).json({ error: 'Token ausente' }); return; }
  try {
    req.userId = Number((jwt.verify(token, secret()) as JwtPayload).id);
    if (!Number.isSafeInteger(req.userId) || req.userId < 1) throw new Error();
  } catch { if (req.apiVersion === 2) sendApiError(req, res, 401, 'Sua sessão expirou. Entre novamente.', 'SESSION_INVALID'); else res.status(401).json({ error: 'Token inválido' }); return; }
  try {
    if (req.apiVersion === 2 && !await User.findByPk(req.userId, { attributes: ['id'] })) { sendApiError(req, res, 401, 'Sua sessão não está mais disponível.', 'SESSION_INVALID'); return; }
    next();
  } catch (error) { next(error); }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token && req.apiVersion === 2) { await requireAuth(req, res, next); return; }
  if (token) { try { req.userId = Number((jwt.verify(token, secret()) as JwtPayload).id); } catch {} }
  next();
}

export { secret };
