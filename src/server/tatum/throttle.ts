import "server-only";

/**
 * Tatum's free plan allows 3 requests a second per key. Every Tatum call in this
 * process, REST or gRPC, takes a slot from this one queue.
 */
const SPACING_MS = 350;
let nextSlot = 0;

export async function tatumSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + SPACING_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function withRetry<T>(call: () => Promise<T>, isRetryable: (error: unknown) => boolean, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await tatumSlot();
    try {
      return await call();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}
