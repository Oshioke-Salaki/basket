import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeReceipt, type ReceiptAnalysis } from "@/domain/findings";
import { primaryCurrency } from "@/domain/inflation";
import { effectiveReceipts, knownItems, type Ledger } from "@/domain/ledger";
import { deriveLessons, lessonsToRecord, mergeLesson, type Lesson } from "@/domain/lessons";
import type { Receipt } from "@/domain/receipt";
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
export async function loadLedger(household: Household, { fresh = false } = {}): Promise<LoadedLedger> {
  const cached = fresh ? null : cachedLedger(household.namespace);
  if (cached) return { ...cached, degraded: false, fromCache: true };
  const recalled = await memoryOf(household).recall();
  const ledger = reconcile(recalled, lastKnownLedger(household.namespace));
  storeLedger(household.namespace, ledger);
  return { ...ledger, degraded: recalled.degraded, fromCache: false };
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
export async function scanReceipt(household: Household, image: ReceiptImage, now = new Date()): Promise<ScanResult> {
  const ledger = await loadLedger(household);
  const homeCurrency = primaryCurrency(ledger.receipts);
  const extraction = await readReceipt(image, knownItems(ledger), homeCurrency);

  const currencyGuess = extraction.currency.trim().toUpperCase();
  const [rate, checkpoint] = await Promise.all([
    usdPerUnit(currencyGuess).catch(() => null),
    latestCheckpoint().then((c) => c.sequence).catch(() => null),
  ]);
  const receipt = toReceipt(extraction, { id: randomUUID(), now, homeCurrency, usdPerUnit: rate, checkpoint });

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
  const learned = lessonsToRecord(deriveLessons(effective), ledger.lessons, now);

  const memory = await memoryOf(household).commit(receipt, learned);
  storeLedger(household.namespace, { receipts: next.receipts, lessons: [...ledger.lessons, ...learned] });
  return { receipt, analysis, learned, memory, duplicateOf: null };
}

/** Record that two item names are one product, then re-learn what that changes. */
export async function mergeItems(household: Household, from: string, into: string, now = new Date()): Promise<{ learned: readonly Lesson[]; memory: MemoryWrite }> {
  if (from === into) throw new AppError("bad_request", "Pick two different items to join.");
  const ledger = await loadLedger(household);
  const effective = effectiveReceipts(ledger);
  const target = effective.flatMap((r) => r.lines).find((l) => l.itemKey === into);
  if (!target || !effective.some((r) => r.lines.some((l) => l.itemKey === from))) {
    throw new AppError("not_found", "One of those items is not in this basket.");
  }
  const merge = mergeLesson(from, into, target.itemName, now);
  const after: Ledger = { receipts: ledger.receipts, lessons: [...ledger.lessons, merge] };
  const relearned = lessonsToRecord(deriveLessons(effectiveReceipts(after)), after.lessons, now);
  const learned = [merge, ...relearned];
  const memory = await memoryOf(household).commit(null, learned);
  storeLedger(household.namespace, { receipts: ledger.receipts, lessons: [...ledger.lessons, ...learned] });
  return { learned, memory };
}

export async function memoryStatus(household: Household, jobIds: readonly string[]): Promise<JobStatus[]> {
  return memoryOf(household).status(jobIds);
}
