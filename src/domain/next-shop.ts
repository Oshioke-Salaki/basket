import { baselineFor } from "./baseline";
import { daysBetween } from "./dates";
import { primaryCurrency } from "./inflation";
import { median, observationsOf, unitPrice, type Observation } from "./observations";
import type { Receipt } from "./receipt";
import { quoteBasis, type Size } from "./units";

/** Look this many days ahead for items coming due. */
export const HORIZON_DAYS = 7;
/** Store prices older than this are too stale to plan a trip around. */
export const PLAN_PRICE_MAX_AGE_DAYS = 90;

export interface DueItem {
  readonly itemKey: string;
  readonly itemName: string;
  readonly size: Size | null;
  readonly quantity: number;
  readonly intervalDays: number;
  readonly lastBoughtOn: string;
  /** Days until due; negative when overdue. */
  readonly dueInDays: number;
  readonly storeKey: string;
  readonly storeName: string;
  /** Expected cost at the chosen store, for the usual quantity. */
  readonly expectedMinor: number;
  /** The same quantity at the household's usual price. */
  readonly usualMinor: number;
}

export interface ShopStop {
  readonly storeKey: string;
  readonly storeName: string;
  readonly items: readonly DueItem[];
  readonly subtotalMinor: number;
}

export interface NextShop {
  readonly currency: string;
  readonly items: readonly DueItem[];
  readonly stops: readonly ShopStop[];
  readonly totalMinor: number;
  /** What the plan saves against paying the usual price for everything on it. */
  readonly savingMinor: number;
  readonly receiptsUsed: number;
}

/**
 * What the household is about to run out of, from the rhythm it buys each item
 * at, and where each is cheapest among the stores it already uses.
 */
export function nextShop(receipts: readonly Receipt[], today: string, home: string | null = primaryCurrency(receipts)): NextShop | null {
  const currency = home;
  if (!currency) return null;
  const observations = observationsOf(receipts).filter((o) => o.currency === currency);
  const byItem = new Map<string, Observation[]>();
  for (const o of observations) byItem.set(o.itemKey, [...(byItem.get(o.itemKey) ?? []), o]);

  const items: DueItem[] = [];
  for (const list of byItem.values()) {
    const dates = [...new Set(list.map((o) => o.date))].sort();
    if (dates.length < 2) continue;
    const intervalDays = Math.round(daysBetween(dates[0]!, dates[dates.length - 1]!) / (dates.length - 1));
    if (intervalDays < 2) continue;
    const lastBoughtOn = dates[dates.length - 1]!;
    const dueInDays = intervalDays - daysBetween(lastBoughtOn, today);
    if (dueInDays > HORIZON_DAYS) continue;

    const latest = list[list.length - 1]!;
    const quantity = median(list.map((o) => o.quantity));
    const basis = unitPrice(latest).basis;
    const perStore = new Map<string, Observation>();
    for (const o of list) {
      if (unitPrice(o).basis !== basis || daysBetween(o.date, today) > PLAN_PRICE_MAX_AGE_DAYS) continue;
      perStore.set(o.storeKey, o);
    }
    const best = [...perStore.values()].sort((a, b) => unitPrice(a).value - unitPrice(b).value)[0] ?? latest;
    const packAt = (unit: number) => (latest.size ? (unit * latest.size.amount) / quoteBasis(latest.size.unit) : unit);
    const baseline = baselineFor({ ...latest, receiptId: "__plan__" }, list);
    items.push({
      itemKey: latest.itemKey,
      itemName: latest.itemName,
      size: latest.size,
      quantity,
      intervalDays,
      lastBoughtOn,
      dueInDays,
      storeKey: best.storeKey,
      storeName: best.storeName,
      expectedMinor: Math.round(packAt(unitPrice(best).value) * quantity),
      usualMinor: Math.round(packAt(baseline?.usual ?? unitPrice(latest).value) * quantity),
    });
  }
  if (items.length === 0) return { currency, items: [], stops: [], totalMinor: 0, savingMinor: 0, receiptsUsed: receipts.length };

  items.sort((a, b) => a.dueInDays - b.dueInDays || a.itemName.localeCompare(b.itemName));
  const stops = new Map<string, DueItem[]>();
  for (const item of items) stops.set(item.storeKey, [...(stops.get(item.storeKey) ?? []), item]);
  const shopStops = [...stops.entries()]
    .map(([storeKey, list]) => ({ storeKey, storeName: list[0]!.storeName, items: list, subtotalMinor: list.reduce((s, i) => s + i.expectedMinor, 0) }))
    .sort((a, b) => b.items.length - a.items.length || b.subtotalMinor - a.subtotalMinor);
  const totalMinor = items.reduce((s, i) => s + i.expectedMinor, 0);
  const usual = items.reduce((s, i) => s + i.usualMinor, 0);
  return { currency, items, stops: shopStops, totalMinor, savingMinor: Math.max(0, usual - totalMinor), receiptsUsed: receipts.length };
}
