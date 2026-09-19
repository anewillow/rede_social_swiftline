import type { Options } from 'express-rate-limit';

export const apiRateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente em alguns minutos.' },
} satisfies Partial<Options>;
