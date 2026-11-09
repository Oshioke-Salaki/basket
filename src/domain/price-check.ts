import { baselineFor } from "./baseline";
import { daysBetween } from "./dates";
import { ELSEWHERE_MAX_AGE_DAYS, USUAL_BAND } from "./findings";
import { fractionDigits } from "./money";
import { observationsOf, unitPrice, type Observation, type PriceBasis } from "./observations";
import type { Receipt } from "./receipt";
import { quoteBasis, type Size } from "./units";

export type Verdict = "good" | "fair" | "high" | "unknown";

export interface PriceSighting {
  readonly storeName: string;
  readonly date: string;
  readonly packMinor: number;
  readonly size: Size | null;
  /** Unit price on the check's basis. */
  readonly unit: number;
}

export interface PriceCheck {
  readonly itemKey: string;
  readonly itemName: string;
  readonly currency: string;
  readonly basis: PriceBasis;
  readonly size: Size | null;
  readonly quotedMinor: number;
  /** The quoted price per basis quantity. */
  readonly quotedUnit: number;
  readonly verdict: Verdict;
  readonly usualUnit: number | null;
  readonly deltaRatio: number | null;
  readonly sampleSize: number;
  readonly lastPaid: PriceSighting | null;
  readonly cheapestRecent: PriceSighting | null;
  /** A fair pack price to offer, rounded down to a sensible step; null when the quote is already fair. */
  readonly offerMinor: number | null;
}

/**
 * Judge a price someone is quoting right now, at a shelf or a market stall,
 * against everything this household has paid for the same item.
 */
export function checkPrice(receipts: readonly Receipt[], input: { itemKey: string; quotedMinor: number; size: Size | null; today: string }): PriceCheck | null {
  const all = observationsOf(receipts).filter((o) => o.itemKey === input.itemKey);
  if (all.length === 0 || !(input.quotedMinor > 0)) return null;
  const latest = all[all.length - 1]!;
  const currency = latest.currency;
  const size = input.size ?? latest.size;
  const probe: Observation = {
    ...latest,
    receiptId: "__check__",
    date: input.today,
    size,
    quantity: 1,
    totalMinor: input.quotedMinor,
    packMinor: input.quotedMinor,
  };
  const history = all.filter((o) => o.currency === currency);
  const quoted = unitPrice(probe);
  const comparable = history.filter((o) => unitPrice(o).basis === quoted.basis && (quoted.basis !== "pack" || sameSize(o.size, size)));
  const baseline = baselineFor(probe, history);
  const sighting = (o: Observation): PriceSighting => ({ storeName: o.storeName, date: o.date, packMinor: o.packMinor, size: o.size, unit: unitPrice(o).value });

  const lastPaid = comparable.length ? sighting(comparable[comparable.length - 1]!) : null;
  const recent = comparable.filter((o) => daysBetween(o.date, input.today) <= ELSEWHERE_MAX_AGE_DAYS);
  const cheapest = recent.length ? recent.reduce((a, b) => (unitPrice(b).value < unitPrice(a).value ? b : a)) : null;

  const deltaRatio = baseline ? quoted.value / baseline.usual - 1 : null;
  const verdict: Verdict = deltaRatio === null ? "unknown" : deltaRatio <= -USUAL_BAND ? "good" : deltaRatio < USUAL_BAND ? "fair" : "high";

  let offerMinor: number | null = null;
  if (baseline) {
    const target = Math.min(baseline.usual, cheapest ? unitPrice(cheapest).value : Infinity);
    if (quoted.value > target * (1 + USUAL_BAND / 2)) {
      const perPack = size ? (target * size.amount) / quoteBasis(size.unit) : target;
      offerMinor = roundDownToStep(perPack, currency);
    }
  }

  return {
    itemKey: input.itemKey,
    itemName: latest.itemName,
    currency,
    basis: quoted.basis,
    size,
    quotedMinor: input.quotedMinor,
    quotedUnit: quoted.value,
    verdict,
    usualUnit: baseline?.usual ?? null,
    deltaRatio,
    sampleSize: baseline?.sampleSize ?? 0,
    lastPaid,
    cheapestRecent: cheapest ? sighting(cheapest) : null,
    offerMinor,
  };
}

/** Round a price down to a step a person would say out loud: 5, 50, 100 or 500 major units. */
export function roundDownToStep(minor: number, currency: string): number {
  const scale = 10 ** fractionDigits(currency);
  const major = minor / scale;
  const step = major < 20 ? 0.5 : major < 100 ? 5 : major < 1_000 ? 50 : major < 10_000 ? 100 : 500;
  return Math.max(step, Math.floor(major / step) * step) * scale;
}

function sameSize(a: Size | null, b: Size | null): boolean {
  if (!a || !b) return a === b;
  return a.unit === b.unit && a.amount === b.amount;
}
