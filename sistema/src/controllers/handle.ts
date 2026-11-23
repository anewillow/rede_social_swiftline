import type { RequestHandler } from 'express';
import type { ServiceInput, ServiceResult } from '../types/service.js';
import { validateInput, text, LIMITS } from '../../shared/contracts/index.js';
import { sendApiError } from '../http/api-errors.js';

type Service = (input: ServiceInput) => Promise<ServiceResult>;

export function handle(service: Service): RequestHandler {
  return async (req, res, next) => {
    try {
      const body = req.apiVersion === 2 ? validateInput(service.name, req.body, req.params) : req.body;
      const query = req.apiVersion === 2 && req.query.q !== undefined ? { ...req.query, q: text(req.query.q, 'q', LIMITS.query) } : req.query;
      const result = await service({ params: req.params, query, body, file: req.file, userId: req.userId, apiVersion: req.apiVersion });
      if (req.apiVersion === 2 && result.code) {
        const data = result.data as { message?: string; error?: string };
        sendApiError(req, res, result.code === 'SESSION_INVALID' || result.code === 'INVALID_CREDENTIALS' ? 401 : result.status, data.message ?? data.error ?? 'Não foi possível concluir.', result.code); return;
      }
      res.status(result.status).json(result.data);
    } catch (error) {
      next(error);
    }
  };
}
