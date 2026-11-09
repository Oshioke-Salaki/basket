import { daysBetween } from "./dates";
import { primaryCurrency } from "./inflation";
import type { Receipt } from "./receipt";

export interface WeeklySpend {
  readonly currency: string;
  readonly weeklyMinor: number;
  readonly weeksObserved: number;
  readonly receipts: number;
}

/**
 * Average weekly grocery spend in the household's main currency. The window runs
 * from the first receipt to a week past the last, so one shop counts as one week.
 */
export function weeklySpend(receipts: readonly Receipt[]): WeeklySpend | null {
  const currency = primaryCurrency(receipts);
  if (!currency) return null;
  const own = receipts.filter((r) => r.currency === currency);
  const dates = own.map((r) => r.purchasedOn).sort();
  const days = daysBetween(dates[0]!, dates[dates.length - 1]!) + 7;
  const weeks = Math.max(1, days / 7);
  const total = own.reduce((sum, r) => sum + r.totalMinor, 0);
  return {
    currency,
    weeklyMinor: Math.round(total / weeks),
    weeksObserved: Math.round(weeks * 10) / 10,
    receipts: own.length,
  };
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
