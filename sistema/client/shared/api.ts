import { decodeFailure, type ApiFailure, type Decoder, type ErrorCode, type Fields } from '../../shared/contracts/index';
export const SESSION_INVALID_EVENT = 'swiftline:session-invalid';
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly status: number, readonly requestId?: string, readonly fields?: Fields) { super(message); this.name = 'ApiError'; }
}
export const messageOf = (error: unknown, fallback = 'Não foi possível concluir. Tente novamente.') => error instanceof ApiError ? error.message : fallback;
export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token'); return token ? { Authorization: 'Bearer ' + token } : {};
}
export async function request<T>(endpoint: string, decode: Decoder<T>, options: RequestInit = {}, authenticated = true): Promise<T> {
  const sentToken = authenticated ? localStorage.getItem('token') : null;
  const headers = new Headers(authenticated ? authHeaders() : undefined);
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
  try {
    const response = await fetch(endpoint, { ...options, headers, signal: controller.signal });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) throw new ApiError('INVALID_RESPONSE', 'O servidor enviou uma resposta inesperada. Tente novamente.', response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', 'Não foi possível ler a resposta do servidor.', response.status); }
    if (!response.ok) {
      let failure: ApiFailure;
      try { failure = decodeFailure(body); } catch { throw new ApiError('INVALID_RESPONSE', 'O servidor enviou uma falha em formato inesperado.', response.status); }
      const error = new ApiError(failure.error.code, failure.error.message, response.status, failure.requestId, failure.error.fields);
      if (error.code === 'SESSION_INVALID' && response.status === 401 && authenticated && sentToken === localStorage.getItem('token')) {
        localStorage.removeItem('token'); localStorage.removeItem('user');
        dispatchEvent(new Event(SESSION_INVALID_EVENT));
      }
      throw error;
    }
    try { return decode(body); } catch { throw new ApiError('INVALID_RESPONSE', 'Os dados recebidos estão incompletos. Tente novamente.', response.status); }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
    throw new ApiError('NETWORK_ERROR', timedOut ? 'O servidor demorou para responder. Tente novamente.' : 'Não foi possível conectar. Confira sua conexão e tente novamente.', 0);
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export function jsonRequest<T>(endpoint: string, method: string, data: unknown, decode: Decoder<T>, authenticated = true): Promise<T> {
  return request(endpoint, decode, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }, authenticated);
}
export function pageUrl(endpoint: string, cursor?: string | null, limit?: number): string {
  const query = new URLSearchParams(); if (cursor) query.set('cursor', cursor); if (limit) query.set('limit', String(limit));
  return endpoint + (query.size ? (endpoint.includes('?') ? '&' : '?') + query.toString() : '');
}
