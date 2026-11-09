import { packPriceMinor, type Category, type Receipt } from "./receipt";
import { quoteBasis, type BaseUnit, type Size } from "./units";

/** One price paid for one item on one day. Every analysis works on these. */
export interface Observation {
  readonly receiptId: string;
  readonly lineIndex: number;
  readonly date: string;
  readonly storeKey: string;
  readonly storeName: string;
  readonly itemKey: string;
  readonly itemName: string;
  readonly category: Category;
  readonly size: Size | null;
  readonly quantity: number;
  readonly totalMinor: number;
  readonly packMinor: number;
  readonly currency: string;
  readonly usdPerUnit: number | null;
  /** True when the USD rate was observed within a few days of the purchase. */
  readonly rateContemporary: boolean;
}

/**
 * The price an observation is compared on. Sized goods compare per 100 g / 100 ml
 * (or each), so a smaller pack at the same price reads as the rise it is.
 */
export interface UnitPrice {
  readonly basis: PriceBasis;
  /** Minor units per basis quantity. Fractional on purpose: never stored. */
  readonly value: number;
}

export type PriceBasis = `measure:${BaseUnit}` | "pack";

export function observationsOf(receipts: readonly Receipt[]): Observation[] {
  const out: Observation[] = [];
  for (const receipt of receipts) {
    receipt.lines.forEach((line, lineIndex) => {
      if (line.totalMinor === 0) return;
      out.push({
        receiptId: receipt.id,
        lineIndex,
        date: receipt.purchasedOn,
        storeKey: receipt.store.key,
        storeName: receipt.store.name,
        itemKey: line.itemKey,
        itemName: line.itemName,
        category: line.category,
        size: line.size,
        quantity: line.quantity,
        totalMinor: line.totalMinor,
        packMinor: packPriceMinor(line),
        currency: receipt.currency,
        usdPerUnit: receipt.usdPerUnit,
        rateContemporary: rateIsContemporary(receipt),
      });
    });
  }
  return out.sort(byDateThenReceipt);
}

/** A receipt's USD rate can price that day's spending only if it was observed close to the purchase. */
export const RATE_WINDOW_DAYS = 3;

export function rateIsContemporary(receipt: Pick<Receipt, "usdPerUnit" | "usdRateOn" | "scannedAt" | "purchasedOn">): boolean {
  if (!receipt.usdPerUnit) return false;
  const on = receipt.usdRateOn ?? receipt.scannedAt.slice(0, 10);
  return Math.abs(Date.parse(on) - Date.parse(receipt.purchasedOn)) <= RATE_WINDOW_DAYS * 86_400_000;
}

export function unitPrice(obs: Observation): UnitPrice {
  if (!obs.size) return { basis: "pack", value: obs.packMinor };
  return {
    basis: `measure:${obs.size.unit}`,
    value: (obs.packMinor / obs.size.amount) * quoteBasis(obs.size.unit),
  };
}

/** Observations of the same item, in the same currency, priced on the same basis. */
export function comparableHistory(
  target: Observation,
  history: readonly Observation[],
): Observation[] {
  const basis = unitPrice(target).basis;
  return history.filter(
    (o) =>
      o.itemKey === target.itemKey &&
      o.currency === target.currency &&
      o.receiptId !== target.receiptId &&
      unitPrice(o).basis === basis &&
      (basis !== "pack" || sameSize(o.size, target.size)),
  );
}

/** Everything bought strictly before a receipt, or earlier the same day. */
export function historyBefore(
  receipt: Pick<Receipt, "id" | "purchasedOn" | "scannedAt">,
  receipts: readonly Receipt[],
): Observation[] {
  const earlier = receipts.filter(
    (r) =>
      r.id !== receipt.id &&
      (r.purchasedOn < receipt.purchasedOn ||
        (r.purchasedOn === receipt.purchasedOn && r.scannedAt < receipt.scannedAt)),
  );
  return observationsOf(earlier);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sameSize(a: Size | null, b: Size | null): boolean {
  if (!a || !b) return a === b;
  return a.unit === b.unit && a.amount === b.amount;
}

function byDateThenReceipt(a: Observation, b: Observation): number {
  return a.date.localeCompare(b.date) || a.receiptId.localeCompare(b.receiptId) || a.lineIndex - b.lineIndex;
}
