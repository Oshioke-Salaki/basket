import "server-only";
import { AppError, type ErrorBody } from "./errors";

/**
 * Wrap a route handler so every failure leaves as `{ error: { code, message } }`
 * with the right status, and nothing internal leaks to the browser.
 */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): Response {
  const appError =
    error instanceof AppError ? error : new AppError("upstream_unavailable", "Something went wrong on our side. Try again.", { cause: error });
  if (!(error instanceof AppError) || appError.status >= 500) {
    console.error(`[basket] ${appError.code}: ${appError.message}`, appError.cause ?? error);
  }
  const body: ErrorBody = { error: { code: appError.code, message: appError.message } };
  const headers: HeadersInit = appError.retryAfterSeconds ? { "Retry-After": String(appError.retryAfterSeconds) } : {};
  return Response.json(body, { status: appError.status, headers });
}

export async function readJson<T>(request: Request, parse: (value: unknown) => T): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError("bad_request", "The request body must be JSON.");
  }
  return parse(value);
}
