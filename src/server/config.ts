import "server-only";
import { z } from "zod";
import { AppError } from "./errors";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z.object({
  ANTHROPIC_API_KEY: optional,
  OPENAI_API_KEY: optional,
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5.5"),
  /** Which provider reads photos; unset picks whichever has a key, OpenAI first. */
  RECEIPT_READER: z.enum(["openai", "anthropic"]).optional(),
  TATUM_API_KEY: optional,
  MEMWAL_PRIVATE_KEY: optional,
  MEMWAL_ACCOUNT_ID: optional,
  MEMWAL_SERVER_URL: z.string().url().default("https://relayer.memory.walrus.xyz"),
  /** Prefix for every household namespace, so one memory account can serve several apps. */
  BASKET_NAMESPACE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]{1,24}$/)
    .default("basket"),
  /** Basket key of the public demo household, opened read-only from the landing page. */
  BASKET_DEMO_KEY: optional,
  /**
   * Swap Walrus, Tatum and Claude for deterministic in-process fakes. For automated
   * tests only: nothing written in this mode reaches a network.
   */
  BASKET_FAKE_SERVICES: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
  /** Tests only: the fake memory hides writes from recall this long, as Walrus indexing does. */
  BASKET_FAKE_INDEX_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(0),
  /** The per-process ledger cache. "off" behaves like serverless instances that share nothing. */
  BASKET_CACHE: z.enum(["on", "off"]).default("on"),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export function config(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new AppError("not_configured", `Server configuration is invalid: ${fields}.`);
  }
  if (parsed.data.BASKET_FAKE_SERVICES && process.env.NODE_ENV === "production" && !process.env.CI) {
    throw new AppError("not_configured", "BASKET_FAKE_SERVICES cannot run in production.");
  }
  cached = parsed.data;
  return cached;
}

/** Read a secret a feature needs, failing with a clear message instead of an opaque 500. */
export function required<K extends keyof Config>(key: K, feature: string): NonNullable<Config[K]> {
  const value = config()[key];
  if (value === undefined || value === null) {
    throw new AppError("not_configured", `${feature} is not configured on this server (${String(key)} is missing).`);
  }
  return value as NonNullable<Config[K]>;
}
