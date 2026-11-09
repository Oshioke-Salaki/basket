import { observationsOf, unitPrice, type Observation } from "./observations";
import { primaryCurrency } from "./inflation";
import type { Receipt } from "./receipt";

export interface StoreStanding {
  readonly storeKey: string;
  readonly storeName: string;
  /** Mean of the store's price relative to the cross-store average; -0.08 = 8% cheaper. */
  readonly relativeRatio: number;
  /** Items this store was compared on. */
  readonly itemsCompared: number;
  readonly visits: number;
}

/** A store needs this many shared items before it gets a standing. */
export const MIN_SHARED_ITEMS = 2;

/** Rank stores by what this household's own items cost there, on each store's latest price. */
export function storeStandings(receipts: readonly Receipt[]): StoreStanding[] {
  const currency = primaryCurrency(receipts);
  if (!currency) return [];
  const observations = observationsOf(receipts).filter((o) => o.currency === currency);

  const latest = new Map<string, Map<string, Observation>>();
  for (const o of observations) {
    const key = `${o.itemKey}|${unitPrice(o).basis}`;
    const perStore = latest.get(key) ?? new Map<string, Observation>();
    perStore.set(o.storeKey, o);
    latest.set(key, perStore);
  }

  const relatives = new Map<string, number[]>();
  for (const perStore of latest.values()) {
    if (perStore.size < 2) continue;
    const prices = [...perStore.values()].map((o) => unitPrice(o).value);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    for (const [storeKey, o] of perStore) {
      const list = relatives.get(storeKey) ?? [];
      list.push(unitPrice(o).value / mean - 1);
      relatives.set(storeKey, list);
    }
  }

  const visits = new Map<string, { name: string; count: number }>();
  for (const r of receipts) {
    if (r.currency !== currency) continue;
    const v = visits.get(r.store.key) ?? { name: r.store.name, count: 0 };
    v.count += 1;
    visits.set(r.store.key, v);
  }

  return [...relatives.entries()]
    .filter(([, list]) => list.length >= MIN_SHARED_ITEMS)
    .map(([storeKey, list]) => ({
      storeKey,
      storeName: visits.get(storeKey)?.name ?? storeKey,
      relativeRatio: list.reduce((a, b) => a + b, 0) / list.length,
      itemsCompared: list.length,
      visits: visits.get(storeKey)?.count ?? 0,
    }))
    .sort((a, b) => a.relativeRatio - b.relativeRatio);
}
