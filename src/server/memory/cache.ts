import "server-only";
import { mergeLedgers, type Ledger } from "@/domain/ledger";
import { config } from "../config";

/**
 * Recall costs a relayer call from a budget shared by every household, and a
 * fresh write takes a while to become searchable. A short per-namespace cache,
 * updated on every write, covers both.
 */
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

interface Entry {
  ledger: Ledger;
  storedAt: number;
}

const entries = new Map<string, Entry>();

export function cachedLedger(namespace: string): Ledger | null {
  if (config().BASKET_CACHE === "off") return null;
  const entry = entries.get(namespace);
  if (!entry || Date.now() - entry.storedAt > TTL_MS) return null;
  return entry.ledger;
}

/** The last ledger this process saw, fresh or not, for reconciling with a new recall. */
export function lastKnownLedger(namespace: string): Ledger | null {
  if (config().BASKET_CACHE === "off") return null;
  return entries.get(namespace)?.ledger ?? null;
}

export function storeLedger(namespace: string, ledger: Ledger): void {
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.delete(namespace);
  entries.set(namespace, { ledger, storedAt: Date.now() });
}

/**
 * Merge what recall returned with what this process wrote recently, so a write
 * the relayer has not indexed yet is not lost from view.
 */
export function reconcile(recalled: Ledger, previous: Ledger | null): Ledger {
  return previous ? mergeLedgers(recalled, previous) : recalled;
}
