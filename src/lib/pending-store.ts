import { mergeLedgers, type Ledger } from "@/domain/ledger";
import { NO_PENDING, PendingSchema, type Pending } from "@/domain/pending";

/**
 * This browser's writes that Walrus Memory may not have indexed yet, per basket.
 * Kept until recall returns them, or for an hour at most. A per-viewer
 * convenience: losing it only means waiting for indexing to catch up.
 */
const MAX_AGE_MS = 60 * 60_000;
const storageKey = (basketId: string) => `basket:pending:${basketId}`;

interface Stored {
  readonly savedAt: number;
  readonly pending: Pending;
}

const version = (r: { revisedAt?: string | null; scannedAt: string }) => r.revisedAt ?? r.scannedAt;

export function loadPending(basketId: string): Pending {
  try {
    const raw = localStorage.getItem(storageKey(basketId));
    if (!raw) return NO_PENDING;
    const stored = JSON.parse(raw) as Stored;
    if (Date.now() - stored.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(storageKey(basketId));
      return NO_PENDING;
    }
    const parsed = PendingSchema.safeParse(stored.pending);
    return parsed.success ? parsed.data : NO_PENDING;
  } catch {
    return NO_PENDING;
  }
}

function save(basketId: string, pending: Pending): void {
  try {
    if (pending.receipts.length === 0 && pending.lessons.length === 0) localStorage.removeItem(storageKey(basketId));
    else localStorage.setItem(storageKey(basketId), JSON.stringify({ savedAt: Date.now(), pending } satisfies Stored));
  } catch {
    // Storage can be full or blocked; the write itself is already on its way to Walrus.
  }
}

export function addPending(basketId: string, written: Ledger): void {
  const merged = mergeLedgers(written, loadPending(basketId));
  save(basketId, { receipts: merged.receipts.slice(-40), lessons: merged.lessons.slice(-300) });
}

/** Drop what recall now returns; keep the rest. */
export function prunePending(basketId: string, recalled: Ledger): Pending {
  const pending = loadPending(basketId);
  const recalledReceipts = new Map(recalled.receipts.map((r) => [r.id, r]));
  const recalledLessons = new Set(recalled.lessons.map((l) => `${l.key}@${l.learnedAt}`));
  const next: Pending = {
    receipts: pending.receipts.filter((r) => {
      const seen = recalledReceipts.get(r.id);
      return !seen || version(r) > version(seen);
    }),
    lessons: pending.lessons.filter((l) => !recalledLessons.has(`${l.key}@${l.learnedAt}`)),
  };
  save(basketId, next);
  return next;
}
