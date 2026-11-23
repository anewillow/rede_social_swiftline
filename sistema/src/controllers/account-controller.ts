import type { RequestHandler } from 'express';
import { deleteAccount as executeDeleteAccount } from '../bootstrap/delete-account.js';
import { AccountDeletionError } from '../modules/accounts/public.js';
import { sendApiError } from '../http/api-errors.js';
import { object, text } from '../../shared/contracts/index.js';

const statusByCode = {
  ACCOUNT_NOT_FOUND: 404,
  PASSWORD_REQUIRED: 400,
  INVALID_PASSWORD: 401,
} as const;

export const deleteAccount: RequestHandler = async (req, res, next) => {
  try {
    if (req.apiVersion === 2) text(object(req.body).password, 'password', 10000, true);
    await executeDeleteAccount({
      userId: req.userId!,
      password: typeof req.body?.password === 'string' ? req.body.password : undefined,
    });
    res.status(200).json({ message: 'Conta excluída com sucesso.' });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      if (req.apiVersion === 2) { sendApiError(req, res, statusByCode[error.code], error.message, error.code === 'INVALID_PASSWORD' ? 'INVALID_CREDENTIALS' : error.code === 'ACCOUNT_NOT_FOUND' ? 'SESSION_INVALID' : 'VALIDATION_ERROR'); return; }
      res.status(statusByCode[error.code]).json({ message: error.message });
      return;
    }
    next(error);
  }
};
