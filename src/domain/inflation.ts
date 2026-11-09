import { daysBetween } from "./dates";
import { observationsOf, unitPrice, type Observation, type PriceBasis } from "./observations";
import type { Receipt } from "./receipt";

/** An item needs sightings at least this far apart before its price change counts. */
export const MIN_SPAN_DAYS = 7;

export type Denomination = "local" | "usd";

export interface IndexPoint {
  readonly date: string;
  /** 100 = prices on the day each item was first seen. */
  readonly value: number;
}

export interface Mover {
  readonly itemKey: string;
  readonly itemName: string;
  readonly changeRatio: number;
  /** Share of the household's spend on tracked items. */
  readonly weight: number;
  readonly firstSeenOn: string;
  readonly lastSeenOn: string;
}

export interface PersonalInflation {
  readonly currency: string;
  readonly denomination: Denomination;
  /** Change in the household's own basket since tracking started; null until it can be measured. */
  readonly changeRatio: number | null;
  readonly series: readonly IndexPoint[];
  readonly movers: readonly Mover[];
  readonly itemsTracked: number;
  readonly sinceDate: string | null;
  readonly untilDate: string | null;
}

interface Track {
  readonly itemKey: string;
  readonly itemName: string;
  readonly basis: PriceBasis;
  readonly points: { date: string; price: number }[];
  spend: number;
}

/** The currency this household spends most in. Mixed-currency receipts are tracked separately. */
export function primaryCurrency(receipts: readonly Receipt[]): string | null {
  const spend = new Map<string, number>();
  for (const r of receipts) spend.set(r.currency, (spend.get(r.currency) ?? 0) + r.totalMinor);
  let best: string | null = null;
  for (const [currency, total] of spend) if (!best || total > spend.get(best)!) best = currency;
  return best;
}

/**
 * A spend-weighted index of this household's own prices: each item's price
 * relative to the first time it was bought, weighted by what the household
 * spends on it. Nothing here comes from an official basket.
 */
export function personalInflation(
  receipts: readonly Receipt[],
  denomination: Denomination = "local",
  home: string | null = primaryCurrency(receipts),
): PersonalInflation {
  const currency = home;
  const empty: PersonalInflation = {
    currency: currency ?? "USD",
    denomination,
    changeRatio: null,
    series: [],
    movers: [],
    itemsTracked: 0,
    sinceDate: null,
    untilDate: null,
  };
  if (!currency) return empty;

  const observations = observationsOf(receipts).filter(
    (o) => o.currency === currency && (denomination === "local" || o.usdPerUnit !== null),
  );
  const tracks = buildTracks(observations, denomination);
  if (tracks.length === 0) return empty;

  const totalSpend = tracks.reduce((sum, t) => sum + t.spend, 0);
  const dates = [...new Set(tracks.flatMap((t) => t.points.map((p) => p.date)))].sort();
  const series = dates.map((date) => ({ date, value: round(indexOn(date, tracks, totalSpend) * 100, 2) }));

  const movers = tracks
    .map<Mover>((t) => ({
      itemKey: t.itemKey,
      itemName: t.itemName,
      changeRatio: t.points[t.points.length - 1]!.price / t.points[0]!.price - 1,
      weight: t.spend / totalSpend,
      firstSeenOn: t.points[0]!.date,
      lastSeenOn: t.points[t.points.length - 1]!.date,
    }))
    .sort((a, b) => Math.abs(b.changeRatio * b.weight) - Math.abs(a.changeRatio * a.weight));

  return {
    currency,
    denomination,
    changeRatio: indexOn(dates[dates.length - 1]!, tracks, totalSpend) - 1,
    series,
    movers,
    itemsTracked: tracks.length,
    sinceDate: dates[0]!,
    untilDate: dates[dates.length - 1]!,
  };
}

function buildTracks(observations: readonly Observation[], denomination: Denomination): Track[] {
  const byItem = new Map<string, Track>();
  for (const o of observations) {
    const { basis, value } = unitPrice(o);
    const key = `${o.itemKey}|${basis}|${basis === "pack" ? o.size?.amount ?? "" : ""}`;
    const price = denomination === "usd" ? value * o.usdPerUnit! : value;
    const track = byItem.get(key) ?? { itemKey: o.itemKey, itemName: o.itemName, basis, points: [], spend: 0 };
    track.points.push({ date: o.date, price });
    track.spend += o.totalMinor;
    byItem.set(key, track);
  }
  return [...byItem.values()].filter(
    (t) => t.points.length >= 2 && daysBetween(t.points[0]!.date, t.points[t.points.length - 1]!.date) >= MIN_SPAN_DAYS,
  );
}

/** Weighted mean of each item's latest-known price on `date` relative to its first price. */
function indexOn(date: string, tracks: readonly Track[], totalSpend: number): number {
  let sum = 0;
  for (const t of tracks) {
    const first = t.points[0]!;
    let latest = first;
    for (const p of t.points) if (p.date <= date) latest = p;
    sum += (t.spend / totalSpend) * (first.date <= date ? latest.price / first.price : 1);
  }
  return sum;
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
