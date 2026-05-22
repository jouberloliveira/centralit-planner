export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'PASSWORD_BREACHED'
  | 'ACCOUNT_LOCKED'
  | 'INTERNAL';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown): HttpError =>
  new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Unauthorized'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Forbidden'): HttpError => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found'): HttpError => new HttpError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string, details?: unknown): HttpError =>
  new HttpError(409, 'CONFLICT', msg, details);
export const unprocessable = (msg: string, details?: unknown): HttpError =>
  new HttpError(422, 'UNPROCESSABLE', msg, details);
export const passwordBreached = (msg: string, details?: unknown): HttpError =>
  new HttpError(422, 'PASSWORD_BREACHED', msg, details);
export const accountLocked = (retryAfterSeconds: number): HttpError =>
  new HttpError(423, 'ACCOUNT_LOCKED', 'Account temporarily locked due to repeated failed logins', {
    retryAfterSeconds,
  });
