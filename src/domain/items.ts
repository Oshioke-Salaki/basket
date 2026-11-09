import { baselineFor } from "./baseline";
import { primaryCurrency } from "./inflation";
import { observationsOf, unitPrice, type Observation, type PriceBasis } from "./observations";
import type { Receipt } from "./receipt";

export interface ItemSummary {
  readonly itemKey: string;
  readonly itemName: string;
  readonly currency: string;
  readonly timesBought: number;
  readonly lastPaidMinor: number;
  readonly lastSeenOn: string;
  readonly basis: PriceBasis;
  /** Usual unit price from every sighting but the latest; null until bought twice. */
  readonly usual: number | null;
  /** Change in unit price from the first to the latest sighting. */
  readonly changeRatio: number | null;
  readonly cheapestStore: string | null;
  readonly observations: readonly Observation[];
}

/** One row per item the household buys, in its main currency. */
export function itemSummaries(receipts: readonly Receipt[]): ItemSummary[] {
  const currency = primaryCurrency(receipts);
  if (!currency) return [];
  const byItem = new Map<string, Observation[]>();
  for (const o of observationsOf(receipts)) {
    if (o.currency !== currency) continue;
    byItem.set(o.itemKey, [...(byItem.get(o.itemKey) ?? []), o]);
  }
  return [...byItem.values()]
    .map((list) => summarize(list, currency))
    .sort((a, b) => b.timesBought - a.timesBought || b.lastSeenOn.localeCompare(a.lastSeenOn));
}

function summarize(list: Observation[], currency: string): ItemSummary {
  const latest = list[list.length - 1]!;
  const basis = unitPrice(latest).basis;
  const comparable = list.filter((o) => unitPrice(o).basis === basis);
  const baseline = baselineFor(latest, list);
  const first = comparable[0]!;
  const byStore = new Map<string, Observation>();
  for (const o of comparable) byStore.set(o.storeKey, o);
  const cheapest = byStore.size > 1 ? [...byStore.values()].sort((a, b) => unitPrice(a).value - unitPrice(b).value)[0]! : null;
  return {
    itemKey: latest.itemKey,
    itemName: latest.itemName,
    currency,
    timesBought: list.length,
    lastPaidMinor: latest.packMinor,
    lastSeenOn: latest.date,
    basis,
    usual: baseline?.usual ?? null,
    changeRatio: comparable.length > 1 && first !== latest ? unitPrice(latest).value / unitPrice(first).value - 1 : null,
    cheapestStore: cheapest?.storeName ?? null,
    observations: list,
  };
}
