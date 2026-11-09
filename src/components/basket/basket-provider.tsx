"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { rateBook, type RateBook } from "@/domain/currency";
import { effectiveReceipts, homeCurrency, mergeLedgers } from "@/domain/ledger";
import { NO_PENDING, type Pending } from "@/domain/pending";
import type { Lesson } from "@/domain/lessons";
import type { Receipt } from "@/domain/receipt";
import type { LineRevision } from "@/domain/revise";
import { api, ApiError } from "@/lib/api";
import { addPending, loadPending, prunePending } from "@/lib/pending-store";
import type { BasketPayload, JobStatePayload, MemoryWritePayload, MergePayload, RevisionPayload, ScanPayload } from "@/lib/api-types";

/** How often pending Walrus writes are checked, and when to stop waiting on them. */
const POLL_MS = 5_000;
const GIVE_UP_MS = 4 * 60_000;

export interface MemoryJob {
  readonly jobId: string;
  readonly state: JobStatePayload | "slow";
  readonly blobId: string | null;
  /** Set on the job that carries a receipt, so its blob can be shown on that receipt. */
  readonly receiptId: string | null;
  readonly startedAt: number;
}

type Status = "loading" | "ready" | "no-basket" | "error";

interface State {
  readonly basketId: string | null;
  readonly status: Status;
  readonly error: string | null;
  readonly receipts: readonly Receipt[];
  readonly lessons: readonly Lesson[];
  readonly readOnly: boolean;
  readonly isDemo: boolean;
  readonly degraded: boolean;
  readonly jobs: Readonly<Record<string, MemoryJob>>;
  readonly lastScan: ScanPayload | null;
  /** Today's USD rates from Tatum, for currencies the screens have asked for. */
  readonly liveRates: Readonly<Record<string, number>>;
}

type Action =
  | { type: "loading" }
  | { type: "loaded"; payload: BasketPayload }
  | { type: "failed"; status: Status; error: string }
  | { type: "scanned"; scan: ScanPayload }
  | { type: "merged"; merge: MergePayload }
  | { type: "revised"; revision: RevisionPayload }
  | { type: "rates"; usdPerUnit: Readonly<Record<string, number>> }
  | { type: "jobs"; updates: readonly Partial<MemoryJob>[] };

const initial: State = {
  basketId: null,
  status: "loading",
  error: null,
  receipts: [],
  lessons: [],
  readOnly: false,
  isDemo: false,
  degraded: false,
  jobs: {},
  lastScan: null,
  liveRates: {},
};

function track(jobs: State["jobs"], write: MemoryWritePayload, receiptId: string | null): State["jobs"] {
  const next = { ...jobs };
  const now = Date.now();
  for (const jobId of write.jobIds) {
    next[jobId] = { jobId, state: "pending", blobId: null, receiptId: jobId === write.receiptJobId ? receiptId : null, startedAt: now };
  }
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { ...state, status: state.status === "ready" ? "ready" : "loading", error: null };
    case "loaded": {
      const { basketId, receipts, lessons, readOnly, isDemo, degraded } = action.payload;
      return { ...state, basketId, status: "ready", error: null, receipts, lessons, readOnly, isDemo, degraded };
    }
    case "failed":
      return { ...state, status: action.status, error: action.error };
    case "scanned": {
      const { scan } = action;
      const receipts = state.receipts.some((r) => r.id === scan.receipt.id) ? state.receipts : [...state.receipts, scan.receipt];
      return {
        ...state,
        receipts,
        lessons: [...state.lessons, ...scan.learned],
        jobs: track(state.jobs, scan.memory, scan.receipt.id),
        lastScan: scan,
      };
    }
    case "merged":
      return { ...state, lessons: [...state.lessons, ...action.merge.learned], jobs: track(state.jobs, action.merge.memory, null) };
    case "revised": {
      const { revision } = action;
      return {
        ...state,
        receipts: state.receipts.map((r) => (r.id === revision.receipt.id ? revision.receipt : r)),
        lessons: [...state.lessons, ...revision.learned],
        jobs: track(state.jobs, revision.memory, revision.receipt.id),
      };
    }
    case "rates":
      return { ...state, liveRates: { ...state.liveRates, ...action.usdPerUnit } };
    case "jobs": {
      const jobs = { ...state.jobs };
      for (const u of action.updates) {
        const current = u.jobId ? jobs[u.jobId] : undefined;
        if (current) jobs[current.jobId] = { ...current, ...u };
      }
      return { ...state, jobs };
    }
  }
}

interface BasketContextValue extends State {
  /** Receipts with the household's confirmed item merges applied, oldest first. */
  readonly effective: readonly Receipt[];
  readonly reload: (fresh?: boolean) => Promise<void>;
  readonly scan: (image: Blob) => Promise<ScanPayload>;
  readonly merge: (from: string, into: string) => Promise<MergePayload>;
  readonly revise: (receiptId: string, revision: LineRevision) => Promise<RevisionPayload>;
  readonly setHomeCurrency: (currency: string) => Promise<void>;
  readonly priceTag: (image: Blob) => ReturnType<typeof api.priceTag>;
  /** Fetch today's rates for currencies not yet in the book. Failures leave the book as it is. */
  readonly ensureRates: (currencies: readonly string[]) => Promise<void>;
  /** The currency the basket is measured in. */
  readonly home: string | null;
  /** USD value per unit: each currency's latest receipt rate, overlaid with today's live rates. */
  readonly rates: RateBook;
  readonly blobFor: (receiptId: string) => MemoryJob | null;
}

const BasketContext = createContext<BasketContextValue | null>(null);

export function BasketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const reload = useCallback(async (fresh = false) => {
    dispatch({ type: "loading" });
    try {
      const payload = await api.basket(fresh);
      // Writes Walrus has not indexed yet stay in view until recall returns them.
      const pending = payload.readOnly ? NO_PENDING : prunePending(payload.basketId, payload);
      dispatch({ type: "loaded", payload: { ...payload, ...mergeLedgers(payload, pending) } });
    } catch (error) {
      const noBasket = error instanceof ApiError && error.status === 401;
      dispatch({ type: "failed", status: noBasket ? "no-basket" : "error", error: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const basketId = state.basketId;
  const pending = useCallback((): Pending => (basketId ? loadPending(basketId) : NO_PENDING), [basketId]);
  const remember = useCallback(
    (written: { receipts?: readonly Receipt[]; lessons?: readonly Lesson[] }) => {
      if (basketId) addPending(basketId, { receipts: written.receipts ?? [], lessons: written.lessons ?? [] });
    },
    [basketId],
  );

  const scan = useCallback(
    async (image: Blob) => {
      const result = await api.scan(image, pending());
      if (!result.duplicateOf) remember({ receipts: [result.receipt], lessons: result.learned });
      dispatch({ type: "scanned", scan: result });
      return result;
    },
    [pending, remember],
  );

  const merge = useCallback(
    async (from: string, into: string) => {
      const result = await api.merge(from, into, pending());
      remember({ lessons: result.learned });
      dispatch({ type: "merged", merge: result });
      return result;
    },
    [pending, remember],
  );

  const revise = useCallback(
    async (receiptId: string, revision: LineRevision) => {
      const result = await api.revise(receiptId, revision, pending());
      remember({ receipts: [result.receipt], lessons: result.learned });
      dispatch({ type: "revised", revision: result });
      return result;
    },
    [pending, remember],
  );

  const setHomeCurrency = useCallback(
    async (currency: string) => {
      const result = await api.setHomeCurrency(currency, pending());
      remember({ lessons: result.learned });
      dispatch({ type: "merged", merge: result });
    },
    [pending, remember],
  );

  const priceTag = useCallback((image: Blob) => api.priceTag(image, pending()), [pending]);

  const liveRef = useRef(state.liveRates);
  useEffect(() => {
    liveRef.current = state.liveRates;
  }, [state.liveRates]);
  const ensureRates = useCallback(async (currencies: readonly string[]) => {
    const missing = [...new Set(currencies)].filter((c) => c !== "USD" && !(c in liveRef.current)).slice(0, 10);
    if (missing.length === 0) return;
    try {
      const { usdPerUnit } = await api.rates(missing);
      dispatch({ type: "rates", usdPerUnit });
    } catch {
      // Receipt rates still convert; a missing live rate only hides a conversion.
    }
  }, []);

  usePendingWrites(state.jobs, dispatch);

  const effective = useMemo(() => effectiveReceipts({ receipts: state.receipts, lessons: state.lessons }), [state.receipts, state.lessons]);
  const home = useMemo(() => homeCurrency({ receipts: state.receipts, lessons: state.lessons }), [state.receipts, state.lessons]);
  const rates = useMemo(() => rateBook(state.receipts, state.liveRates), [state.receipts, state.liveRates]);

  // The home currency and every currency in the basket get today's rate once.
  const currencies = useMemo(() => [...new Set([...(home ? [home] : []), ...state.receipts.map((r) => r.currency)])].sort().join(","), [home, state.receipts]);
  useEffect(() => {
    if (currencies) void ensureRates(currencies.split(","));
  }, [currencies, ensureRates]);
  const blobFor = useCallback(
    (receiptId: string) => Object.values(state.jobs).find((j) => j.receiptId === receiptId) ?? null,
    [state.jobs],
  );

  const value = useMemo<BasketContextValue>(
    () => ({ ...state, effective, home, rates, reload, scan, merge, revise, setHomeCurrency, priceTag, ensureRates, blobFor }),
    [state, effective, home, rates, reload, scan, merge, revise, setHomeCurrency, priceTag, ensureRates, blobFor],
  );
  return <BasketContext value={value}>{children}</BasketContext>;
}

export function useBasket(): BasketContextValue {
  const value = useContext(BasketContext);
  if (!value) throw new Error("useBasket must be used inside <BasketProvider>");
  return value;
}

const TERMINAL = new Set<MemoryJob["state"]>(["done", "failed", "not_found", "slow"]);

/** Poll Walrus Memory for writes still on their way, so the household sees each one land. */
function usePendingWrites(jobs: State["jobs"], dispatch: (a: Action) => void) {
  const pending = Object.values(jobs).filter((j) => !TERMINAL.has(j.state));
  const key = pending.map((j) => j.jobId).sort().join(",");
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const now = Date.now();
      const open = Object.values(jobsRef.current).filter((j) => !TERMINAL.has(j.state));
      const stale = open.filter((j) => now - j.startedAt > GIVE_UP_MS);
      if (stale.length) dispatch({ type: "jobs", updates: stale.map((j) => ({ jobId: j.jobId, state: "slow" as const })) });
      const live = open.filter((j) => now - j.startedAt <= GIVE_UP_MS).slice(0, 40);
      if (live.length === 0) return;
      try {
        const { jobs: statuses } = await api.memoryStatus(live.map((j) => j.jobId));
        if (!cancelled) dispatch({ type: "jobs", updates: statuses.map((s) => ({ jobId: s.jobId, state: s.state, blobId: s.blobId })) });
      } catch {
        // A missed poll is retried on the next tick; the write itself is already accepted.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, dispatch]);
}
