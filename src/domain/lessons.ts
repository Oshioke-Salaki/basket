import { z } from "zod";
import { baselineFor } from "./baseline";
import { formatDay } from "./dates";
import { personalInflation, primaryCurrency } from "./inflation";
import { formatMoney, formatPercent, formatUnitPrice } from "./money";
import { observationsOf, unitPrice, type Observation } from "./observations";
import type { Receipt } from "./receipt";
import { purchaseCadence } from "./spend";
import { storeStandings } from "./stores";
import { formatBasis, formatSize } from "./units";

export const LESSON_KINDS = [
  "usual_price",
  "cheapest_store",
  "shrinkflation",
  "cadence",
  "inflation",
  "best_store",
  "same_item",
  "home_currency",
] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

/**
 * Something Basket has learned about this household. A lesson is written to
 * memory once, and again only when its signature changes, so the memory log
 * reads as a history of what the app came to believe and when.
 */
export const LessonSchema = z.object({
  key: z.string().min(1).max(160),
  kind: z.enum(LESSON_KINDS),
  text: z.string().min(1).max(400),
  signature: z.string().max(160),
  learnedAt: z.string().datetime(),
  /** Item merges carry the keys they join; other lessons carry nothing extra. */
  merge: z.object({ from: z.string(), into: z.string(), name: z.string() }).nullable(),
  /** Set on the household's home-currency choice. */
  homeCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

type Draft = Omit<Lesson, "learnedAt" | "merge" | "homeCurrency"> & { merge?: Lesson["merge"] };

/** The newest lesson per key. */
export function currentLessons(lessons: readonly Lesson[]): Lesson[] {
  const byKey = new Map<string, Lesson>();
  for (const l of lessons) {
    const current = byKey.get(l.key);
    if (!current || current.learnedAt < l.learnedAt) byKey.set(l.key, l);
  }
  return [...byKey.values()].sort((a, b) => b.learnedAt.localeCompare(a.learnedAt));
}

/**
 * Item merges the household confirmed. Applying them before any analysis lets one
 * correction re-key every past receipt, so history the app could not join before
 * starts counting at once.
 */
export function applyMerges(receipts: readonly Receipt[], lessons: readonly Lesson[]): Receipt[] {
  const into = new Map<string, { key: string; name: string }>();
  for (const l of currentLessons(lessons)) if (l.merge) into.set(l.merge.from, { key: l.merge.into, name: l.merge.name });
  if (into.size === 0) return [...receipts];
  const resolve = (key: string) => {
    const seen = new Set<string>();
    let target: { key: string; name: string } | undefined;
    let cursor = key;
    while (into.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      target = into.get(cursor)!;
      cursor = target.key;
    }
    return target;
  };
  return receipts.map((r) => ({
    ...r,
    lines: r.lines.map((line) => {
      const target = resolve(line.itemKey);
      return target ? { ...line, itemKey: target.key, itemName: target.name } : line;
    }),
  }));
}

export function mergeLesson(from: string, into: string, name: string, now: Date): Lesson {
  return {
    key: `same_item:${from}`,
    kind: "same_item",
    text: `Two names, one product: "${from}" is the same item as ${name}. Their price histories are now one.`,
    signature: into,
    learnedAt: now.toISOString(),
    merge: { from, into, name },
  };
}

/** Everything the ledger currently supports believing. */
export function deriveLessons(receipts: readonly Receipt[], home: string | null = primaryCurrency(receipts)): Draft[] {
  const currency = home;
  if (!currency) return [];
  const drafts: Draft[] = [];
  const observations = observationsOf(receipts).filter((o) => o.currency === currency);

  for (const latest of latestPerItem(observations)) {
    const baseline = baselineFor({ ...latest, receiptId: "__probe__" }, observations);
    if (baseline && baseline.sampleSize >= 2) {
      const price = baseline.basis === "pack" ? formatMoney(Math.round(baseline.usual), currency) : formatUnitPrice(baseline.usual, currency);
      const size = latest.size ? ` (${formatSize(latest.size)})` : "";
      const basis = baseline.basis === "pack" ? "" : ` ${formatBasis(latest.size!.unit)}`;
      drafts.push({
        key: `usual_price:${latest.itemKey}`,
        kind: "usual_price",
        text: `Usual price for ${latest.itemName}${size}: ${price}${basis}, from ${baseline.sampleSize} purchases.`,
        signature: bucket(baseline.usual, 0.02),
      });
    }
  }

  for (const shrink of shrinkEvents(observations)) {
    drafts.push({
      key: `shrinkflation:${shrink.itemKey}`,
      kind: "shrinkflation",
      text: `${shrink.itemName} shrank from ${formatSize(shrink.before.size!)} to ${formatSize(shrink.after.size!)} on ${formatDay(shrink.after.date, { year: true })} while the pack price held at ${formatMoney(shrink.after.packMinor, currency)}.`,
      signature: `${shrink.after.size!.amount}${shrink.after.size!.unit}`,
    });
  }

  for (const cheap of cheapestStorePerItem(observations)) {
    drafts.push({
      key: `cheapest_store:${cheap.itemKey}`,
      kind: "cheapest_store",
      text: `${cheap.itemName} is cheapest at ${cheap.storeName}: ${formatPercent(cheap.savingRatio, { signed: false })} less than the dearest store you use.`,
      signature: cheap.storeKey,
    });
  }

  const names = new Map(observations.map((o) => [o.itemKey, o.itemName]));
  for (const [itemKey, cadence] of purchaseCadence(receipts.filter((r) => r.currency === currency))) {
    if (!names.has(itemKey) || cadence.days < 1) continue;
    drafts.push({
      key: `cadence:${itemKey}`,
      kind: "cadence",
      text: `You buy ${names.get(itemKey)} about every ${cadence.days} days (${cadence.count} purchases).`,
      signature: String(Math.round(cadence.days / 2) * 2),
    });
  }

  const standings = storeStandings(receipts, currency);
  if (standings.length >= 2) {
    const best = standings[0]!;
    drafts.push({
      key: "best_store",
      kind: "best_store",
      text: `For the things you actually buy, ${best.storeName} is your cheapest store: ${formatPercent(-best.relativeRatio, { signed: false })} under the average, across ${best.itemsCompared} shared items.`,
      signature: best.storeKey,
    });
  }

  const inflation = personalInflation(receipts, "local", currency);
  if (inflation.changeRatio !== null && inflation.untilDate) {
    const month = inflation.untilDate.slice(0, 7);
    drafts.push({
      key: `inflation:${month}`,
      kind: "inflation",
      text: `Your personal basket inflation reached ${formatPercent(inflation.changeRatio)} by ${formatDay(inflation.untilDate, { year: true })}, across ${inflation.itemsTracked} items you buy repeatedly.`,
      signature: bucketAbsolute(inflation.changeRatio, 0.005),
    });
  }

  return drafts;
}

/** Lessons whose belief is new or has changed since memory last recorded it. */
export function lessonsToRecord(drafts: readonly Draft[], known: readonly Lesson[], now: Date): Lesson[] {
  const current = new Map(currentLessons(known).map((l) => [l.key, l]));
  return drafts
    .filter((d) => current.get(d.key)?.signature !== d.signature)
    .map((d) => ({ ...d, merge: d.merge ?? null, learnedAt: now.toISOString() }));
}

function latestPerItem(observations: readonly Observation[]): Observation[] {
  const latest = new Map<string, Observation>();
  for (const o of observations) latest.set(o.itemKey, o);
  return [...latest.values()];
}

function shrinkEvents(observations: readonly Observation[]) {
  const out: { itemKey: string; itemName: string; before: Observation; after: Observation }[] = [];
  const last = new Map<string, Observation>();
  const events = new Map<string, (typeof out)[number]>();
  for (const o of observations) {
    const prev = last.get(o.itemKey);
    if (prev?.size && o.size && prev.size.unit === o.size.unit && o.size.amount < prev.size.amount && o.packMinor >= prev.packMinor * 0.97) {
      events.set(o.itemKey, { itemKey: o.itemKey, itemName: o.itemName, before: prev, after: o });
    }
    if (o.size) last.set(o.itemKey, o);
  }
  out.push(...events.values());
  return out;
}

function cheapestStorePerItem(observations: readonly Observation[]) {
  const perItem = new Map<string, Map<string, Observation>>();
  for (const o of observations) {
    const key = `${o.itemKey}|${unitPrice(o).basis}`;
    const stores = perItem.get(key) ?? new Map<string, Observation>();
    stores.set(o.storeKey, o);
    perItem.set(key, stores);
  }
  const out: { itemKey: string; itemName: string; storeKey: string; storeName: string; savingRatio: number }[] = [];
  for (const stores of perItem.values()) {
    if (stores.size < 2) continue;
    const ranked = [...stores.values()].sort((a, b) => unitPrice(a).value - unitPrice(b).value);
    const cheapest = ranked[0]!;
    const dearest = ranked[ranked.length - 1]!;
    const savingRatio = 1 - unitPrice(cheapest).value / unitPrice(dearest).value;
    if (savingRatio < 0.03) continue;
    out.push({ itemKey: cheapest.itemKey, itemName: cheapest.itemName, storeKey: cheapest.storeKey, storeName: cheapest.storeName, savingRatio });
  }
  return out;
}

/** Log-scale bucket so a signature only changes when the value moves by about `step`. */
function bucket(value: number, step: number): string {
  return String(Math.round(Math.log(value) / Math.log(1 + step)));
}

function bucketAbsolute(value: number, step: number): string {
  return String(Math.round(value / step));
}

/** The home currency the household chose, if it has. */
export function chosenHomeCurrency(lessons: readonly Lesson[]): string | null {
  return currentLessons(lessons).find((l) => l.kind === "home_currency")?.homeCurrency ?? null;
}

export function homeCurrencyLesson(currency: string, now: Date): Lesson {
  return {
    key: "home_currency",
    kind: "home_currency",
    text: `This household's home currency is ${currency}. Spending, inflation and the next shop are counted in it.`,
    signature: currency,
    learnedAt: now.toISOString(),
    merge: null,
    homeCurrency: currency,
  };
}
