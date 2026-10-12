import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const secret = () => process.env.JWT_SECRET ?? 'swiftline-development-secret';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Token ausente' }); return; }
  try { req.userId = Number((jwt.verify(token, secret()) as JwtPayload).id); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) { try { req.userId = Number((jwt.verify(token, secret()) as JwtPayload).id); } catch {} }
  next();
}

export { secret };