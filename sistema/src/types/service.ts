import type { Request } from 'express';

export type ServiceInput = Pick<Request, "params" | "query" | "body" | "file" | "userId"> & { apiVersion?: 2 };
export type ServiceResult = { status: number; data: unknown; code?: import('../../shared/contracts/index.js').ErrorCode };

export function serviceResult(data: unknown, status = 200): ServiceResult {
  return { status, data };
}
