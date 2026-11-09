import type { ReceiptAnalysis } from "@/domain/findings";
import type { Lesson } from "@/domain/lessons";
import type { Receipt } from "@/domain/receipt";

/** Shapes exchanged between the browser and Basket's API routes. */

export interface BasketPayload {
  /** Stable per basket; the browser keys its unindexed writes by it. */
  readonly basketId: string;
  readonly receipts: readonly Receipt[];
  readonly lessons: readonly Lesson[];
  readonly degraded: boolean;
  readonly readOnly: boolean;
  readonly isDemo: boolean;
}

export interface MemoryWritePayload {
  readonly jobIds: readonly string[];
  readonly receiptJobId: string | null;
}

export interface ScanPayload {
  readonly receipt: Receipt;
  readonly analysis: ReceiptAnalysis;
  readonly learned: readonly Lesson[];
  readonly memory: MemoryWritePayload;
  readonly duplicateOf: string | null;
}

export interface MergePayload {
  readonly learned: readonly Lesson[];
  readonly memory: MemoryWritePayload;
}

export type JobStatePayload = "pending" | "running" | "uploaded" | "done" | "failed" | "not_found";

export interface MemoryStatusPayload {
  readonly jobs: readonly { readonly jobId: string; readonly state: JobStatePayload; readonly blobId: string | null }[];
}

export interface SessionPayload {
  /** Returned once, when a new basket is created, so the household can keep it. */
  readonly key: string | null;
  readonly isDemo: boolean;
}

export interface RunwayPayload {
  readonly address: string;
  readonly sui: { readonly amount: number; readonly usd: number };
  readonly usdc: { readonly amount: number; readonly usd: number };
  readonly otherCoins: number;
  readonly totalUsd: number;
  readonly currency: string;
  readonly holdingsMinor: number;
  readonly rates: { readonly suiUsd: number; readonly usdPerUnit: number; readonly asOf: string; readonly source: string };
}

export interface ProofPayload {
  readonly account: { readonly objectId: string; readonly type: string; readonly version: string; readonly owner: string };
  readonly checkpoint: { readonly sequence: string; readonly timestamp: string | null };
  readonly namespaces: { readonly receipts: string; readonly lessons: string };
  readonly relayer: string;
}

export interface ApiErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export interface PriceTagPayload {
  /** The household's item this price is for, or null when it is something they have not bought. */
  readonly itemKey: string | null;
  readonly itemName: string;
  readonly quotedMinor: number;
  readonly currency: string;
  readonly size: { readonly amount: number; readonly unit: "g" | "ml" | "unit" } | null;
}

export interface RevisionPayload {
  readonly receipt: Receipt;
  readonly learned: readonly Lesson[];
  readonly memory: MemoryWritePayload;
}

export interface RatesPayload {
  /** USD value of one major unit of each currency asked for. */
  readonly usdPerUnit: Readonly<Record<string, number>>;
  readonly asOf: string | null;
  readonly missing: readonly string[];
}
