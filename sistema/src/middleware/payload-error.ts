import type { NextFunction, Request, Response } from 'express';

export const payloadErrorHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  if ((error as { type?: string }).type === 'entity.too.large') {
    const message = req.originalUrl.startsWith('/api/auth/profile')
      ? 'As imagens selecionadas ultrapassam o limite permitido.'
      : 'A solicitação ultrapassa o limite permitido.';
    return res.status(413).json({ message });
  }
  return next(error);
};
