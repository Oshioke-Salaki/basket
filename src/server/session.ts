import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";
import { AppError } from "./errors";

/**
 * A household is identified by its basket key: 128 random bits shown to the
 * household once, so they can open the same basket on another device. The key
 * never reaches Walrus; namespaces are derived from its hash.
 */
const COOKIE = "basket_key";
const DEMO_VALUE = "demo";
const KEY_PATTERN = /^bsk_[a-z2-7]{26}$/;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Household {
  readonly namespace: string;
  readonly readOnly: boolean;
  readonly isDemo: boolean;
}

export function newBasketKey(): string {
  return `bsk_${base32(randomBytes(16))}`;
}

export function isBasketKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

export function namespaceFor(key: string): string {
  const digest = createHash("sha256").update(`basket-namespace:${key}`).digest("hex").slice(0, 32);
  return `${config().BASKET_NAMESPACE_PREFIX}-${digest}`;
}

/** The household this request belongs to, or null when the browser has no basket yet. */
export async function currentHousehold(): Promise<Household | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  if (value === DEMO_VALUE) {
    const demoKey = config().BASKET_DEMO_KEY;
    return demoKey ? { namespace: namespaceFor(demoKey), readOnly: true, isDemo: true } : null;
  }
  if (!isBasketKey(value)) return null;
  return { namespace: namespaceFor(value), readOnly: false, isDemo: false };
}

export async function requireHousehold({ write = false } = {}): Promise<Household> {
  const household = await currentHousehold();
  if (!household) throw new AppError("unauthorized", "Open or start a basket first.");
  if (write && household.readOnly) {
    throw new AppError("read_only", "The demo basket is read-only. Start your own basket to scan receipts.");
  }
  return household;
}

export async function openBasket(key: string): Promise<void> {
  if (!isBasketKey(key)) throw new AppError("bad_request", "That is not a basket key. Keys start with bsk_.");
  const demoKey = config().BASKET_DEMO_KEY;
  if (demoKey && safeEqual(key, demoKey)) {
    throw new AppError("bad_request", "That key belongs to the public demo basket.");
  }
  await setCookie(key);
}

export async function openDemoBasket(): Promise<void> {
  if (!config().BASKET_DEMO_KEY) throw new AppError("not_configured", "No demo basket is set up on this server.");
  await setCookie(DEMO_VALUE);
}

export async function currentBasketKey(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && isBasketKey(value) ? value : null;
}

export async function closeBasket(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

async function setCookie(value: string): Promise<void> {
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
