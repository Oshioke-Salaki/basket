import type {
  ApiErrorBody,
  BasketPayload,
  MemoryStatusPayload,
  MergePayload,
  PriceTagPayload,
  ProofPayload,
  RatesPayload,
  RevisionPayload,
  RunwayPayload,
  ScanPayload,
  SessionPayload,
} from "./api-types";
import type { LineRevision } from "@/domain/revise";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network", "You appear to be offline. Check the connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, error?.code ?? "unknown", error?.message ?? `Request failed (${res.status}).`);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  basket: (fresh = false) => call<BasketPayload>(`/api/basket${fresh ? "?fresh=1" : ""}`),
  scan: (image: Blob) => {
    const form = new FormData();
    form.append("image", image, "receipt");
    return call<ScanPayload>("/api/basket/receipts", { method: "POST", body: form });
  },
  merge: (from: string, into: string) => call<MergePayload>("/api/basket/merge", json({ from, into })),
  revise: (receiptId: string, revision: LineRevision) =>
    call<RevisionPayload>(`/api/basket/receipts/${encodeURIComponent(receiptId)}`, { ...json(revision), method: "PATCH" }),
  setHomeCurrency: (homeCurrency: string) => call<MergePayload>("/api/basket/settings", json({ homeCurrency })),
  priceTag: (image: Blob) => {
    const form = new FormData();
    form.append("image", image, "price");
    return call<PriceTagPayload>("/api/basket/price-tag", { method: "POST", body: form });
  },
  rates: (currencies: readonly string[]) => call<RatesPayload>(`/api/rates?currencies=${currencies.map(encodeURIComponent).join(",")}`),
  memoryStatus: (jobIds: readonly string[]) => call<MemoryStatusPayload>(`/api/basket/memory?jobs=${jobIds.map(encodeURIComponent).join(",")}`),
  runway: (address: string) => call<RunwayPayload>(`/api/basket/runway?address=${encodeURIComponent(address)}`),
  proof: () => call<ProofPayload>("/api/basket/proof"),
  newBasket: () => call<SessionPayload>("/api/session", json({ action: "new" })),
  openBasket: (key: string) => call<SessionPayload>("/api/session", json({ action: "open", key })),
  openDemo: () => call<SessionPayload>("/api/session", json({ action: "demo" })),
  basketKey: () => call<{ key: string }>("/api/session"),
  closeBasket: () => call<void>("/api/session", { method: "DELETE" }),
};
