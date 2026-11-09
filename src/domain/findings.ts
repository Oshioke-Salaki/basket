import { baselineFor, latestElsewhere } from "./baseline";
import { daysBetween } from "./dates";
import { historyBefore, observationsOf, unitPrice, type Observation, type PriceBasis } from "./observations";
import type { Receipt } from "./receipt";
import type { Size } from "./units";

/** A price within this band of the usual reads as normal. */
export const USUAL_BAND = 0.05;
/** Another store has to be at least this much cheaper to be worth a mention. */
export const ELSEWHERE_MARGIN = 0.05;
/** Other-store prices older than this are too stale to recommend. */
export const ELSEWHERE_MAX_AGE_DAYS = 60;
/** A smaller pack counts as shrinkflation unless the pack price fell by more than this. */
export const SHRINK_PRICE_TOLERANCE = 0.03;

interface Base {
  readonly lineIndex: number;
  readonly itemKey: string;
  readonly itemName: string;
}

export type Finding =
  | (Base & { readonly kind: "first_sighting" })
  | (Base & {
      readonly kind: "above_usual" | "below_usual" | "on_usual";
      readonly basis: PriceBasis;
      readonly paid: number;
      readonly usual: number;
      readonly deltaRatio: number;
      /** Minor units this line cost over (+) or under (-) the usual price. */
      readonly differenceMinor: number;
      readonly sampleSize: number;
    })
  | (Base & {
      readonly kind: "cheaper_elsewhere";
      readonly basis: PriceBasis;
      readonly storeName: string;
      readonly seenOn: string;
      readonly paid: number;
      readonly theirs: number;
      readonly deltaRatio: number;
      readonly couldSaveMinor: number;
    })
  | (Base & {
      readonly kind: "shrinkflation";
      readonly before: Size;
      readonly after: Size;
      readonly packBeforeMinor: number;
      readonly packAfterMinor: number;
      /** Rise in the price per gram / ml / unit caused by the smaller pack. */
      readonly measureRiseRatio: number;
      readonly seenOn: string;
    });

export type FindingKind = Finding["kind"];

export interface ReceiptAnalysis {
  readonly receiptId: string;
  readonly findings: readonly Finding[];
  /** Lines the household had bought before, so a usual price existed. */
  readonly knownLines: number;
  readonly totalLines: number;
  /** Net minor units paid over (+) or under (-) usual across known lines. */
  readonly netDifferenceMinor: number;
  /** Minor units that other stores would have saved, at their last seen prices. */
  readonly couldSaveMinor: number;
}

/**
 * Compare every line of a receipt with what this household paid before it.
 * `receipts` may include the receipt itself; only earlier purchases count as history.
 */
export function analyzeReceipt(receipt: Receipt, receipts: readonly Receipt[]): ReceiptAnalysis {
  const history = historyBefore(receipt, receipts);
  const findings: Finding[] = [];
  let knownLines = 0;
  let netDifferenceMinor = 0;
  let couldSaveMinor = 0;

  for (const obs of observationsOf([receipt])) {
    const base: Base = { lineIndex: obs.lineIndex, itemKey: obs.itemKey, itemName: obs.itemName };
    const shrink = shrinkflationFor(obs, history);
    if (shrink) findings.push({ ...base, ...shrink });

    const baseline = baselineFor(obs, history);
    if (!baseline) {
      if (!shrink) findings.push({ ...base, kind: "first_sighting" });
      continue;
    }

    knownLines += 1;
    const paid = unitPrice(obs).value;
    const deltaRatio = paid / baseline.usual - 1;
    const differenceMinor = Math.round(obs.totalMinor * (1 - baseline.usual / paid));
    netDifferenceMinor += differenceMinor;
    findings.push({
      ...base,
      kind: deltaRatio >= USUAL_BAND ? "above_usual" : deltaRatio <= -USUAL_BAND ? "below_usual" : "on_usual",
      basis: baseline.basis,
      paid,
      usual: baseline.usual,
      deltaRatio,
      differenceMinor,
      sampleSize: baseline.sampleSize,
    });

    const cheaper = cheapestElsewhere(obs, history, paid);
    if (cheaper) {
      couldSaveMinor += cheaper.couldSaveMinor;
      findings.push({ ...base, ...cheaper });
    }
  }

  return {
    receiptId: receipt.id,
    findings,
    knownLines,
    totalLines: receipt.lines.length,
    netDifferenceMinor,
    couldSaveMinor,
  };
}

function cheapestElsewhere(obs: Observation, history: readonly Observation[], paid: number) {
  let best: { other: Observation; theirs: number } | null = null;
  for (const other of latestElsewhere(obs, history)) {
    if (daysBetween(other.date, obs.date) > ELSEWHERE_MAX_AGE_DAYS) continue;
    const theirs = unitPrice(other).value;
    if (theirs <= paid * (1 - ELSEWHERE_MARGIN) && (!best || theirs < best.theirs)) best = { other, theirs };
  }
  if (!best) return null;
  return {
    kind: "cheaper_elsewhere" as const,
    basis: unitPrice(obs).basis,
    storeName: best.other.storeName,
    seenOn: best.other.date,
    paid,
    theirs: best.theirs,
    deltaRatio: best.theirs / paid - 1,
    couldSaveMinor: Math.round(obs.totalMinor * (1 - best.theirs / paid)),
  };
}

function shrinkflationFor(obs: Observation, history: readonly Observation[]) {
  if (!obs.size) return null;
  const size = obs.size;
  let previous: Observation | null = null;
  for (const o of history) {
    if (o.itemKey !== obs.itemKey || o.currency !== obs.currency || !o.size) continue;
    if (o.size.unit !== size.unit) continue;
    if (!previous || previous.date <= o.date) previous = o;
  }
  if (!previous?.size || previous.size.amount <= size.amount) return null;
  if (obs.packMinor < previous.packMinor * (1 - SHRINK_PRICE_TOLERANCE)) return null;
  const before = previous.packMinor / previous.size.amount;
  const after = obs.packMinor / size.amount;
  return {
    kind: "shrinkflation" as const,
    before: previous.size,
    after: size,
    packBeforeMinor: previous.packMinor,
    packAfterMinor: obs.packMinor,
    measureRiseRatio: after / before - 1,
    seenOn: previous.date,
  };
}
