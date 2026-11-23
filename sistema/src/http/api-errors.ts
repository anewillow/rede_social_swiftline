import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError, ConnectionError } from 'sequelize';
import { ValidationFailure, type ErrorCode, type Fields } from '../../shared/contracts/index.js';

declare global { namespace Express { interface Request { apiVersion?: 2; requestId?: string; } } }
const codes: Record<number, ErrorCode> = { 400: 'VALIDATION_ERROR', 401: 'INVALID_CREDENTIALS', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA', 429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR', 503: 'SERVICE_UNAVAILABLE' };
export function sendApiError(req: Request, res: Response, status: number, message: string, code = codes[status] ?? 'INTERNAL_ERROR', fields?: Fields): void {
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) }, requestId: req.requestId ?? randomUUID() });
}
export const requestIdentity = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = randomUUID(); res.setHeader('X-Request-ID', req.requestId);
  if (req.originalUrl.startsWith('/api/v2/') || req.originalUrl === '/api/v2') req.apiVersion = 2;
  // Known legacy errors keep their existing body. All v2 errors share one JSON contract.
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (req.apiVersion === 2 && res.statusCode >= 400 && !(body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'object')) {
      const data = body as { message?: unknown; error?: unknown };
      return json({ error: { code: codes[res.statusCode] ?? 'INTERNAL_ERROR', message: typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : 'Não foi possível concluir a solicitação.' }, requestId: req.requestId });
    }
    return json(body);
  }) as Response['json'];
  next();
};
export const apiErrorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) { next(error); return; }
  if (res.headersSent) { next(error); return; }
  const failure = error as { type?: string; status?: number };
  if (error instanceof ValidationFailure) { sendApiError(req, res, 400, error.message, 'VALIDATION_ERROR', error.fields); return; }
  if (failure.type === 'entity.too.large') { sendApiError(req, res, 413, 'A solicitação ultrapassa o limite permitido.'); return; }
  if (failure.type === 'entity.parse.failed' || error instanceof SyntaxError && failure.status === 400) { sendApiError(req, res, 400, 'O JSON enviado é inválido.'); return; }
  if (error instanceof URIError) { sendApiError(req, res, 400, 'O endereço enviado é inválido.'); return; }
  if (error instanceof UniqueConstraintError || error instanceof ForeignKeyConstraintError) { sendApiError(req, res, 409, 'Os dados mudaram ou já existem. Atualize a tela e tente novamente.'); return; }
  if (error instanceof ValidationError) { sendApiError(req, res, 400, 'Confira os dados enviados.'); return; }
  if (error instanceof ConnectionError) { sendApiError(req, res, 503, 'O serviço está temporariamente indisponível. Tente novamente.'); return; }
  console.error('Falha na solicitação', req.requestId);
  sendApiError(req, res, 500, 'Não foi possível concluir a solicitação. Tente novamente.');
};
