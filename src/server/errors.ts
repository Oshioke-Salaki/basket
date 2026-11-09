/**
 * Every failure a route can surface. The message is safe to show the household;
 * detail for operators goes to the server log through `cause`.
 */
export const ERROR_STATUS = {
  bad_request: 400,
  unauthorized: 401,
  read_only: 403,
  not_found: 404,
  payload_too_large: 413,
  unreadable_receipt: 422,
  rate_limited: 429,
  upstream_unavailable: 502,
  not_configured: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ErrorCode, message: string, options: { cause?: unknown; retryAfterSeconds?: number } = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export interface ErrorBody {
  readonly error: { readonly code: ErrorCode; readonly message: string };
}
