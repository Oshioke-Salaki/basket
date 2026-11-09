import "server-only";
import { MemWalRateLimitedError, isTimeoutError } from "@mysten-incubation/memwal";
import type { Ledger } from "@/domain/ledger";
import type { Lesson } from "@/domain/lessons";
import type { Receipt } from "@/domain/receipt";
import { newerVersion } from "@/domain/revise";
import { AppError } from "../errors";
import { decodeLesson, decodeReceipt, encodeLesson, encodeReceipt } from "./codec";
import type { MemoryPort } from "./port";

/** The relayer returns at most this many memories per recall. */
export const RECALL_CAP = 100;
/** The relayer accepts at most this many memories per bulk write. */
export const BULK_CAP = 20;
/** The relayer answers at most this many job ids per status request. */
export const STATUS_CAP = 20;

export interface MemoryWrite {
  readonly jobIds: readonly string[];
  /** The job carrying the receipt itself, polled to show the household its blob. */
  readonly receiptJobId: string | null;
}

export type JobState = "pending" | "running" | "uploaded" | "done" | "failed" | "not_found";

export interface JobStatus {
  readonly jobId: string;
  readonly state: JobState;
  readonly blobId: string | null;
}

/**
 * A household's memory lives in two namespaces: one holds receipts (the facts),
 * the other lessons (what Basket concluded from them).
 */
export class BasketMemory {
  constructor(
    private readonly port: MemoryPort,
    private readonly namespace: string,
  ) {}

  get receiptsNamespace(): string {
    return `${this.namespace}-receipts`;
  }

  get lessonsNamespace(): string {
    return `${this.namespace}-lessons`;
  }

  async recall(): Promise<Ledger & { degraded: boolean }> {
    const [receipts, lessons] = await Promise.all([
      this.recallAll(this.receiptsNamespace, "grocery receipt store items prices total"),
      this.recallAll(this.lessonsNamespace, "Basket learned usual price cheapest store"),
    ]);
    const byId = new Map<string, Receipt>();
    for (const r of receipts.texts.map(decodeReceipt)) {
      if (!r) continue;
      const seen = byId.get(r.id);
      byId.set(r.id, seen ? newerVersion(seen, r) : r);
    }
    return {
      receipts: [...byId.values()],
      lessons: lessons.texts.map(decodeLesson).filter((l): l is Lesson => l !== null),
      degraded: receipts.degraded || lessons.degraded,
    };
  }

  /** Write a receipt and any lessons in one bulk request, so a scan costs one relayer call. */
  async commit(receipt: Receipt | null, lessons: readonly Lesson[]): Promise<MemoryWrite> {
    const items = [
      ...(receipt ? [{ text: encodeReceipt(receipt), namespace: this.receiptsNamespace }] : []),
      ...lessons.map((l) => ({ text: encodeLesson(l), namespace: this.lessonsNamespace })),
    ];
    if (items.length === 0) return { jobIds: [], receiptJobId: null };
    const jobIds: string[] = [];
    for (let i = 0; i < items.length; i += BULK_CAP) {
      const accepted = await guard(() => this.port.rememberBulk(items.slice(i, i + BULK_CAP)));
      jobIds.push(...accepted.job_ids);
    }
    return { jobIds, receiptJobId: receipt ? (jobIds[0] ?? null) : null };
  }

  /** The relayer answers at most 20 job ids per status request, so larger checks go in batches. */
  async status(jobIds: readonly string[]): Promise<JobStatus[]> {
    const out: JobStatus[] = [];
    for (let i = 0; i < jobIds.length; i += STATUS_CAP) {
      const { results } = await guard(() => this.port.getRememberBulkStatus(jobIds.slice(i, i + STATUS_CAP)));
      out.push(...results.map((r) => ({ jobId: r.job_id, state: r.status, blobId: r.blob_id ?? null })));
    }
    return out;
  }

  private async recallAll(namespace: string, query: string) {
    const result = await guard(() => this.port.recall({ query, namespace, limit: RECALL_CAP, sort: "recent" }));
    return { texts: result.results.map((r) => r.text), degraded: Boolean(result.degraded) };
  }
}

/** Translate relayer failures into errors the household can act on. */
async function guard<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof MemWalRateLimitedError || (error as { status?: number }).status === 429) {
      throw new AppError("rate_limited", "Walrus Memory is busy. Try again in a minute.", { cause: error, retryAfterSeconds: 60 });
    }
    if (isTimeoutError(error)) {
      throw new AppError("upstream_unavailable", "Walrus Memory took too long to answer. Try again.", { cause: error });
    }
    throw new AppError("upstream_unavailable", "Walrus Memory could not be reached.", { cause: error });
  }
}
