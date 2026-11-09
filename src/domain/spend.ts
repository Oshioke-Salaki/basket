import { daysBetween } from "./dates";
import { receiptInHome, type RateBook } from "./currency";
import { primaryCurrency } from "./inflation";
import type { Receipt } from "./receipt";

export interface WeeklySpend {
  readonly currency: string;
  readonly weeklyMinor: number;
  readonly weeksObserved: number;
  readonly receipts: number;
  /** Receipts in other currencies that could not be converted and were left out. */
  readonly unconverted: number;
}

/**
 * Average weekly grocery spend in the household's main currency. The window runs
 * from the first receipt to a week past the last, so one shop counts as one week.
 */
export function weeklySpend(receipts: readonly Receipt[], home: string | null = primaryCurrency(receipts), book: RateBook = {}): WeeklySpend | null {
  if (!home || receipts.length === 0) return null;
  let total = 0;
  let unconverted = 0;
  let counted = 0;
  for (const r of receipts) {
    const inHome = receiptInHome(r, home, receipts, book);
    if (inHome === null) unconverted += 1;
    else {
      total += inHome;
      counted += 1;
    }
  }
  if (counted === 0) return null;
  const dates = receipts.map((r) => r.purchasedOn).sort();
  const days = daysBetween(dates[0]!, dates[dates.length - 1]!) + 7;
  const weeks = Math.max(1, days / 7);
  return { currency: home, weeklyMinor: Math.round(total / weeks), weeksObserved: Math.round(weeks * 10) / 10, receipts: counted, unconverted };
}

export interface Runway {
  readonly weeks: number;
  readonly holdingsMinor: number;
  readonly weeklyMinor: number;
  readonly currency: string;
}

/** How many weeks of this household's real groceries a balance would cover. */
export function runway(holdingsMinor: number, spend: WeeklySpend): Runway | null {
  if (spend.weeklyMinor <= 0) return null;
  return {
    weeks: holdingsMinor / spend.weeklyMinor,
    holdingsMinor,
    weeklyMinor: spend.weeklyMinor,
    currency: spend.currency,
  };
}

/** Average days between purchases of each item bought at least three times. */
export function purchaseCadence(receipts: readonly Receipt[]): Map<string, { days: number; count: number }> {
  const dates = new Map<string, Set<string>>();
  for (const r of receipts)
    for (const line of r.lines) {
      const set = dates.get(line.itemKey) ?? new Set<string>();
      set.add(r.purchasedOn);
      dates.set(line.itemKey, set);
    }
  const out = new Map<string, { days: number; count: number }>();
  for (const [itemKey, set] of dates) {
    if (set.size < 3) continue;
    const sorted = [...set].sort();
    const span = daysBetween(sorted[0]!, sorted[sorted.length - 1]!);
    out.set(itemKey, { days: Math.round(span / (sorted.length - 1)), count: sorted.length });
  }
  return out;
}
