import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: JwtPayload;
    }
  }
}

export {};