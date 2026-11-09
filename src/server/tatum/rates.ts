import "server-only";
import { z } from "zod";
import { config, required } from "../config";
import { AppError } from "../errors";
import { withRetry } from "./throttle";

const API = "https://api.tatum.io/v4/data/rate/symbol";
const TTL_MS = 10 * 60_000;

const RateSchema = z.object({
  value: z.coerce.number().positive(),
  basePair: z.string(),
  symbol: z.string(),
  timestamp: z.number(),
  source: z.string().optional(),
});

export interface Rate {
  /** How many units of `quote` one unit of `base` is worth. */
  readonly value: number;
  readonly base: string;
  readonly quote: string;
  readonly asOf: string;
  readonly source: string;
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Tatum rate request failed with HTTP ${status}`);
  }
}

const cache = new Map<string, { rate: Rate; at: number }>();

/** The value of one `base` (a fiat code or a crypto symbol) in `quote`, from Tatum's Data API. */
export async function rate(base: string, quote: string): Promise<Rate> {
  if (base === quote) return { value: 1, base, quote, asOf: new Date().toISOString(), source: "identity" };
  const key = `${base}/${quote}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rate;
  if (config().BASKET_FAKE_SERVICES) return remember(key, fakeRate(base, quote));

  const apiKey = required("TATUM_API_KEY", "Tatum");
  const url = `${API}?symbol=${encodeURIComponent(base)}&basePair=${encodeURIComponent(quote)}`;
  try {
    const body = await withRetry(
      async () => {
        const res = await fetch(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
        if (!res.ok) throw new HttpError(res.status);
        return RateSchema.parse(await res.json());
      },
      (e) => e instanceof HttpError && (e.status === 429 || e.status >= 500),
    );
    return remember(key, { value: body.value, base, quote, asOf: new Date(body.timestamp).toISOString(), source: body.source ?? "Tatum" });
  } catch (error) {
    throw new AppError("upstream_unavailable", `Tatum has no ${base}/${quote} rate right now.`, { cause: error });
  }
}

/** USD value of one major unit of `currency`, or null when Tatum cannot price it. */
export async function usdPerUnit(currency: string): Promise<number | null> {
  try {
    return (await rate(currency, "USD")).value;
  } catch {
    return null;
  }
}

function remember(key: string, value: Rate): Rate {
  cache.set(key, { rate: value, at: Date.now() });
  return value;
}

const FAKE_USD: Record<string, number> = { USD: 1, NGN: 0.00065, EUR: 1.08, GBP: 1.27, KES: 0.0077, GHS: 0.064, SUI: 1.9, USDC: 1 };

function fakeRate(base: string, quote: string): Rate {
  const b = FAKE_USD[base];
  const q = FAKE_USD[quote];
  if (!b || !q) throw new AppError("upstream_unavailable", `No ${base}/${quote} rate.`);
  return { value: b / q, base, quote, asOf: new Date().toISOString(), source: "fake" };
}
