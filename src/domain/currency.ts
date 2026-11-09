import { daysBetween } from "./dates";
import { fractionDigits, toMajor } from "./money";
import type { Receipt } from "./receipt";

/**
 * Currencies offered first in pickers: the ones most households and travellers use.
 * Any ISO 4217 code the runtime knows is accepted too.
 */
export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "JPY", "INR", "ZAR", "KES", "GHS", "CHF", "AED", "SGD", "BRL", "MXN", "CNY", "NZD", "SEK", "EGP"] as const;

/** USD value of one major unit, per currency. */
export type RateBook = Readonly<Record<string, number>>;

/**
 * The household's home currency: what it chose, else the currency it spends most in
 * (by value in dollars). Inflation, stores and the next shop are measured in it;
 * everything else converts into it.
 */
export function homeCurrencyOf(receipts: readonly Receipt[], chosen: string | null): string | null {
  if (chosen) return chosen;
  const spend = new Map<string, number>();
  for (const r of receipts) {
    const usd = r.usdPerUnit ? toMajor(r.totalMinor, r.currency) * r.usdPerUnit : 0;
    spend.set(r.currency, (spend.get(r.currency) ?? 0) + usd + 1e-9);
  }
  let best: string | null = null;
  for (const [c, v] of spend) if (!best || v > spend.get(best)!) best = c;
  return best;
}

/** The latest USD rate each currency was seen at on a receipt, overlaid with any live rates. */
export function rateBook(receipts: readonly Receipt[], live: RateBook = {}): RateBook {
  const book: Record<string, { rate: number; at: string }> = {};
  for (const r of receipts) {
    if (!r.usdPerUnit) continue;
    const seen = book[r.currency];
    if (!seen || seen.at < r.purchasedOn) book[r.currency] = { rate: r.usdPerUnit, at: r.purchasedOn };
  }
  const out: Record<string, number> = Object.fromEntries(Object.entries(book).map(([c, v]) => [c, v.rate]));
  return { ...out, ...live, USD: 1 };
}

/** Convert a derived amount (a unit price) between currencies through USD, without rounding. */
export function convertExact(minor: number, from: string, to: string, fromUsd: number | null | undefined, toUsd: number | null | undefined): number | null {
  if (from === to) return minor;
  if (!fromUsd || !toUsd) return null;
  return toMajor(minor, from) * (fromUsd / toUsd) * 10 ** fractionDigits(to);
}

/** Convert minor units between currencies through USD; null when either rate is unknown. */
export function convertMinor(minor: number, from: string, to: string, fromUsd: number | null | undefined, toUsd: number | null | undefined): number | null {
  const exact = convertExact(minor, from, to, fromUsd, toUsd);
  return exact === null ? null : Math.round(exact);
}

/**
 * The home currency's USD rate closest to a day, from the household's own home
 * receipts, so an old trip converts at the rate of its time, not today's.
 */
export function homeRateOn(date: string, home: string, receipts: readonly Receipt[], book: RateBook): number | null {
  if (home === "USD") return 1;
  let best: { rate: number; gap: number } | null = null;
  for (const r of receipts) {
    if (r.currency !== home || !r.usdPerUnit) continue;
    const gap = Math.abs(daysBetween(r.purchasedOn, date));
    if (!best || gap < best.gap) best = { rate: r.usdPerUnit, gap };
  }
  return best && best.gap <= 31 ? best.rate : (book[home] ?? best?.rate ?? null);
}

/** A receipt's total in the home currency, at the rates of its own day. */
export function receiptInHome(receipt: Receipt, home: string, receipts: readonly Receipt[], book: RateBook): number | null {
  if (receipt.currency === home) return receipt.totalMinor;
  return convertMinor(receipt.totalMinor, receipt.currency, home, receipt.usdPerUnit ?? book[receipt.currency], homeRateOn(receipt.purchasedOn, home, receipts, book));
}
