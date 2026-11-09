import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeReceipt, type ReceiptAnalysis } from "@/domain/findings";
import { effectiveReceipts, homeCurrency, knownItems, type Ledger } from "@/domain/ledger";
import { deriveLessons, homeCurrencyLesson, lessonsToRecord, mergeLesson, type Lesson } from "@/domain/lessons";
import type { Receipt } from "@/domain/receipt";
import { reviseReceipt, RevisionError, type LineRevision } from "@/domain/revise";
import { NO_PENDING, type Pending } from "@/domain/pending";
import { AppError } from "../errors";
import { cachedLedger, lastKnownLedger, reconcile, storeLedger } from "../memory/cache";
import { memoryClient } from "../memory/client";
import { BasketMemory, type JobStatus, type MemoryWrite } from "../memory/repository";
import type { Household } from "../session";
import { usdPerUnit } from "../tatum/rates";
import { latestCheckpoint } from "../tatum/sui";
import { readReceipt, type ReceiptImage } from "../vision/reader";
import { toReceipt } from "./to-receipt";

function memoryOf(household: Household): BasketMemory {
  return new BasketMemory(memoryClient(), household.namespace);
}

export interface LoadedLedger extends Ledger {
  readonly degraded: boolean;
  readonly fromCache: boolean;
}

/** Everything the household's Walrus Memory holds, served from a short cache when it can be. */
export async function loadLedger(household: Household, { fresh = false, pending = NO_PENDING }: { fresh?: boolean; pending?: Pending } = {}): Promise<LoadedLedger> {
  const cached = fresh ? null : cachedLedger(household.namespace);
  if (cached) return { ...reconcile(pending, cached), degraded: false, fromCache: true };
  const recalled = await memoryOf(household).recall();
  const ledger = reconcile(recalled, lastKnownLedger(household.namespace));
  storeLedger(household.namespace, ledger);
  // The browser's own unindexed writes join what Walrus returned; newer versions win.
  return { ...reconcile(pending, ledger), degraded: recalled.degraded, fromCache: false };
}

export interface ScanResult {
  readonly receipt: Receipt;
  readonly analysis: ReceiptAnalysis;
  readonly learned: readonly Lesson[];
  readonly memory: MemoryWrite;
  readonly duplicateOf: string | null;
}

/**
 * Read a receipt, judge it against everything remembered, and write the receipt
 * and whatever Basket newly learned back to Walrus Memory in one call.
 */
export async function scanReceipt(household: Household, image: ReceiptImage, pending: Pending = NO_PENDING, now = new Date()): Promise<ScanResult> {
  const ledger = await loadLedger(household, { pending });
  const home = homeCurrency(ledger);
  const extraction = await readReceipt(image, knownItems(ledger), home);

  const currencyGuess = extraction.currency.trim().toUpperCase();
  const [rate, checkpoint] = await Promise.all([
    usdPerUnit(currencyGuess).catch(() => null),
    latestCheckpoint().then((c) => c.sequence).catch(() => null),
  ]);
  const receipt = toReceipt(extraction, { id: randomUUID(), now, homeCurrency: home, usdPerUnit: rate, checkpoint });

  const duplicate = ledger.receipts.find(
    (r) => r.store.key === receipt.store.key && r.purchasedOn === receipt.purchasedOn && r.totalMinor === receipt.totalMinor,
  );
  if (duplicate) {
    const effective = effectiveReceipts(ledger);
    const target = effective.find((r) => r.id === duplicate.id)!;
    return { receipt: duplicate, analysis: analyzeReceipt(target, effective), learned: [], memory: { jobIds: [], receiptJobId: null }, duplicateOf: duplicate.id };
  }

  const next: Ledger = { receipts: [...ledger.receipts, receipt], lessons: ledger.lessons };
  const effective = effectiveReceipts(next);
  const analysis = analyzeReceipt(effective.find((r) => r.id === receipt.id)!, effective);
  const learned = lessonsToRecord(deriveLessons(effective, homeCurrency(next)), ledger.lessons, now);

  const memory = await memoryOf(household).commit(receipt, learned);
  storeLedger(household.namespace, { receipts: next.receipts, lessons: [...ledger.lessons, ...learned] });
  return { receipt, analysis, learned, memory, duplicateOf: null };
}

/** Record that two item names are one product, then re-learn what that changes. */
export async function mergeItems(household: Household, from: string, into: string, pending: Pending = NO_PENDING, now = new Date()): Promise<{ learned: readonly Lesson[]; memory: MemoryWrite }> {
  if (from === into) throw new AppError("bad_request", "Pick two different items to join.");
  const ledger = await loadLedger(household, { pending });
  const effective = effectiveReceipts(ledger);
  const target = effective.flatMap((r) => r.lines).find((l) => l.itemKey === into);
  if (!target || !effective.some((r) => r.lines.some((l) => l.itemKey === from))) {
    throw new AppError("not_found", "One of those items is not in this basket.");
  }
  const merge = mergeLesson(from, into, target.itemName, now);
  const after: Ledger = { receipts: ledger.receipts, lessons: [...ledger.lessons, merge] };
  const relearned = lessonsToRecord(deriveLessons(effectiveReceipts(after), homeCurrency(after)), after.lessons, now);
  const learned = [merge, ...relearned];
  const memory = await memoryOf(household).commit(null, learned);
  storeLedger(household.namespace, { receipts: ledger.receipts, lessons: [...ledger.lessons, ...learned] });
  return { learned, memory };
}

export async function memoryStatus(household: Household, jobIds: readonly string[]): Promise<JobStatus[]> {
  return memoryOf(household).status(jobIds);
}

/** Correct a line the reader got wrong: a new version of the receipt goes to Walrus, then lessons are re-learned. */
export async function reviseLine(household: Household, receiptId: string, revision: LineRevision, pending: Pending = NO_PENDING, now = new Date()): Promise<{ receipt: Receipt; learned: readonly Lesson[]; memory: MemoryWrite }> {
  const ledger = await loadLedger(household, { pending });
  const current = ledger.receipts.find((r) => r.id === receiptId);
  if (!current) throw new AppError("not_found", "That receipt is not in this basket.");
  let receipt: Receipt;
  try {
    receipt = reviseReceipt(current, revision, now);
  } catch (error) {
    if (error instanceof RevisionError) throw new AppError("bad_request", error.message);
    throw new AppError("bad_request", "That correction is not valid.", { cause: error });
  }
  const next: Ledger = { receipts: ledger.receipts.map((r) => (r.id === receiptId ? receipt : r)), lessons: ledger.lessons };
  const learned = lessonsToRecord(deriveLessons(effectiveReceipts(next), homeCurrency(next)), ledger.lessons, now);
  const memory = await memoryOf(household).commit(receipt, learned);
  storeLedger(household.namespace, { receipts: next.receipts, lessons: [...ledger.lessons, ...learned] });
  return { receipt, learned, memory };
}

/** Set the household's home currency, and re-learn what that changes. */
export async function setHomeCurrency(household: Household, currency: string, pending: Pending = NO_PENDING, now = new Date()): Promise<{ learned: readonly Lesson[]; memory: MemoryWrite }> {
  const ledger = await loadLedger(household, { pending });
  const choice = homeCurrencyLesson(currency, now);
  const after: Ledger = { receipts: ledger.receipts, lessons: [...ledger.lessons, choice] };
  const relearned = lessonsToRecord(deriveLessons(effectiveReceipts(after), currency), after.lessons, now);
  const learned = [choice, ...relearned];
  const memory = await memoryOf(household).commit(null, learned);
  storeLedger(household.namespace, { receipts: ledger.receipts, lessons: [...ledger.lessons, ...learned] });
  return { learned, memory };
}
