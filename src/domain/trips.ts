import { baselineFor } from "./baseline";
import { convertExact, homeRateOn, receiptInHome, type RateBook } from "./currency";
import { daysBetween } from "./dates";
import { observationsOf, unitPrice, type Observation } from "./observations";
import type { Receipt } from "./receipt";

/** Receipts in one foreign currency this close together belong to one trip. */
export const TRIP_GAP_DAYS = 14;

export interface AbroadComparison {
  readonly itemKey: string;
  readonly itemName: string;
  /** The price abroad per basis quantity, converted to home minor units. */
  readonly abroadHome: number;
  readonly homeUsual: number;
  /** abroad / home: 2.3 means it cost 2.3 times what the household pays at home. */
  readonly ratio: number;
  readonly basis: string;
}

export interface Trip {
  readonly id: string;
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  readonly days: number;
  readonly receipts: readonly Receipt[];
  readonly totalMinor: number;
  /** The trip's spend in the home currency at each receipt's own rate; null when a rate is missing. */
  readonly totalHomeMinor: number | null;
  readonly stores: readonly string[];
  readonly comparisons: readonly AbroadComparison[];
}

/** Group spending in other currencies into trips, and price what was bought there against home. */
export function tripsOf(receipts: readonly Receipt[], home: string, book: RateBook): Trip[] {
  const foreign = receipts.filter((r) => r.currency !== home).sort((a, b) => a.purchasedOn.localeCompare(b.purchasedOn));
  const groups: Receipt[][] = [];
  for (const r of foreign) {
    const open = groups.find((g) => g[0]!.currency === r.currency && daysBetween(g[g.length - 1]!.purchasedOn, r.purchasedOn) <= TRIP_GAP_DAYS);
    if (open) open.push(r);
    else groups.push([r]);
  }
  const homeObs = observationsOf(receipts).filter((o) => o.currency === home);

  return groups
    .map((group) => {
      const from = group[0]!.purchasedOn;
      const to = group[group.length - 1]!.purchasedOn;
      const homeTotals = group.map((r) => receiptInHome(r, home, receipts, book));
      const comparisons = new Map<string, AbroadComparison>();
      for (const o of observationsOf(group)) {
        const local = homeObs.filter((h) => h.itemKey === o.itemKey);
        if (local.length === 0) continue;
        const baseline = baselineFor({ ...o, currency: home, receiptId: "__trip__" } as Observation, local);
        if (!baseline) continue;
        const r = group.find((x) => x.id === o.receiptId)!;
        const abroad = convertExact(unitPrice(o).value, o.currency, home, r.usdPerUnit ?? book[o.currency], homeRateOn(o.date, home, receipts, book));
        if (abroad === null) continue;
        comparisons.set(o.itemKey, { itemKey: o.itemKey, itemName: o.itemName, abroadHome: abroad, homeUsual: baseline.usual, ratio: abroad / baseline.usual, basis: baseline.basis });
      }
      return {
        id: `${group[0]!.currency}-${from}`,
        currency: group[0]!.currency,
        from,
        to,
        days: daysBetween(from, to) + 1,
        receipts: group,
        totalMinor: group.reduce((s, r) => s + r.totalMinor, 0),
        totalHomeMinor: homeTotals.every((t) => t !== null) ? homeTotals.reduce((s, t) => s! + t!, 0) : null,
        stores: [...new Set(group.map((r) => r.store.name))],
        comparisons: [...comparisons.values()].sort((a, b) => b.ratio - a.ratio),
      };
    })
    .sort((a, b) => b.from.localeCompare(a.from));
}
