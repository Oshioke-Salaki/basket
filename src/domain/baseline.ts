import { comparableHistory, median, unitPrice, type Observation, type PriceBasis } from "./observations";

/** How many recent sightings the usual price is drawn from. */
export const BASELINE_WINDOW = 6;

export interface Baseline {
  readonly basis: PriceBasis;
  /** Median unit price over the most recent sightings, in minor units per basis. */
  readonly usual: number;
  readonly sampleSize: number;
  readonly lastSeenOn: string;
}

/** What this household usually pays for the item in `target`, from earlier sightings only. */
export function baselineFor(target: Observation, history: readonly Observation[]): Baseline | null {
  const comparable = comparableHistory(target, history);
  if (comparable.length === 0) return null;
  const recent = comparable.slice(-BASELINE_WINDOW);
  return {
    basis: unitPrice(target).basis,
    usual: median(recent.map((o) => unitPrice(o).value)),
    sampleSize: comparable.length,
    lastSeenOn: recent[recent.length - 1]!.date,
  };
}

/** The most recent sighting of the item at each store other than the target's own. */
export function latestElsewhere(target: Observation, history: readonly Observation[]): Observation[] {
  const latest = new Map<string, Observation>();
  for (const o of comparableHistory(target, history)) {
    if (o.storeKey === target.storeKey) continue;
    const current = latest.get(o.storeKey);
    if (!current || current.date <= o.date) latest.set(o.storeKey, o);
  }
  return [...latest.values()];
}
