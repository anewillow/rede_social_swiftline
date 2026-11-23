import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { apiRateLimitOptions, siteRateLimitOptions } from './config/rate-limit.js';
import { clientDirectory, clientEntry, uploadsPath } from './config/paths.js';
import { payloadErrorHandler } from './middleware/payload-error.js';
import apiRoutes from './routes/index.js';
import { apiErrorHandler, requestIdentity, sendApiError } from './http/api-errors.js';

const app = express();

app.use(requestIdentity);
app.use(rateLimit(siteRateLimitOptions));
app.use('/api', rateLimit(apiRateLimitOptions));
app.use('/api/auth/profile', express.json({ limit: '9mb' }));
app.use('/api/v2/auth/profile', express.json({ limit: '9mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(payloadErrorHandler);
app.use('/uploads', express.static(uploadsPath));
app.use(express.static(clientDirectory));
app.use('/api/v2', (req, res, next) => {
  req.apiVersion = 2;
  req.url = '/api' + (req.url === '/' ? '' : req.url);
  apiRoutes(req, res, next);
});
app.use(apiRoutes);
app.use('/api', (req, res) => sendApiError(req, res, 404, 'Endereço da API não encontrado.'));
app.use(apiErrorHandler);
app.get('/{*splat}', (_req, res) => res.sendFile(clientEntry));

export default app;
