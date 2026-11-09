import { applyMerges, currentLessons, type Lesson } from "./lessons";
import type { Receipt } from "./receipt";
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
