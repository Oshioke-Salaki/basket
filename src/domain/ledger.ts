import { homeCurrencyOf } from "./currency";
import { applyMerges, chosenHomeCurrency, currentLessons, type Lesson } from "./lessons";
import type { Receipt } from "./receipt";
import { newerVersion } from "./revise";
import type { Size } from "./units";

/** Everything Basket remembers about one household, as recalled from Walrus Memory. */
export interface Ledger {
  readonly receipts: readonly Receipt[];
  readonly lessons: readonly Lesson[];
}

export const EMPTY_LEDGER: Ledger = { receipts: [], lessons: [] };

/** Receipts with the household's confirmed item merges applied, oldest first. */
export function effectiveReceipts(ledger: Ledger): Receipt[] {
  return applyMerges(ledger.receipts, ledger.lessons).sort(
    (a, b) => a.purchasedOn.localeCompare(b.purchasedOn) || a.scannedAt.localeCompare(b.scannedAt),
  );
}

export interface KnownItem {
  readonly itemKey: string;
  readonly itemName: string;
  readonly sizes: readonly Size[];
  readonly lastPrinted: string;
  readonly timesBought: number;
}

/**
 * The items this household has bought before. Handing these to the receipt reader
 * is how memory shapes extraction: a new receipt's "PEAK MLK 400G" lands on the
 * key the household's history already uses, so its price has something to compare to.
 */
export function knownItems(ledger: Ledger, limit = 150): KnownItem[] {
  const items = new Map<string, { itemName: string; sizes: Map<string, Size>; lastPrinted: string; timesBought: number; lastOn: string }>();
  for (const r of effectiveReceipts(ledger)) {
    for (const line of r.lines) {
      const item = items.get(line.itemKey) ?? { itemName: line.itemName, sizes: new Map(), lastPrinted: line.raw, timesBought: 0, lastOn: r.purchasedOn };
      if (line.size) item.sizes.set(`${line.size.amount}${line.size.unit}`, line.size);
      item.itemName = line.itemName;
      item.lastPrinted = line.raw;
      item.timesBought += 1;
      item.lastOn = r.purchasedOn;
      items.set(line.itemKey, item);
    }
  }
  return [...items.entries()]
    .sort(([, a], [, b]) => b.timesBought - a.timesBought || b.lastOn.localeCompare(a.lastOn))
    .slice(0, limit)
    .map(([itemKey, i]) => ({ itemKey, itemName: i.itemName, sizes: [...i.sizes.values()], lastPrinted: i.lastPrinted, timesBought: i.timesBought }));
}

export function memoryCount(ledger: Ledger): number {
  return ledger.receipts.length + ledger.lessons.length;
}

export { currentLessons };

/** The currency this household's basket is measured in. */
export function homeCurrency(ledger: Ledger): string | null {
  return homeCurrencyOf(ledger.receipts, chosenHomeCurrency(ledger.lessons));
}

/**
 * Union two views of one basket: every receipt once (its newest version) and every
 * lesson once (by key and time learned). Used to join what Walrus recalled with
 * writes it has not indexed yet.
 */
export function mergeLedgers(a: Ledger, b: Ledger): Ledger {
  const receipts = new Map<string, Receipt>();
  for (const r of [...b.receipts, ...a.receipts]) {
    const seen = receipts.get(r.id);
    receipts.set(r.id, seen ? newerVersion(seen, r) : r);
  }
  const lessons = new Map<string, Lesson>();
  for (const l of [...b.lessons, ...a.lessons]) lessons.set(`${l.key}@${l.learnedAt}`, l);
  return { receipts: [...receipts.values()], lessons: [...lessons.values()] };
}
