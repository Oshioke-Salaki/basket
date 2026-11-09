import "server-only";
import { MemWal, MemWalMock, type RecallParams } from "@mysten-incubation/memwal";
import { config, required } from "../config";
import type { MemoryPort } from "./port";

let instance: MemoryPort | null = null;

/** One Walrus Memory client per server process; namespaces carry the household. */
export function memoryClient(): MemoryPort {
  if (instance) return instance;
  const cfg = config();
  if (cfg.BASKET_FAKE_SERVICES) {
    instance = withIndexDelay(MemWalMock.create({ namespace: "basket-fake" }) as unknown as MemoryPort, cfg.BASKET_FAKE_INDEX_DELAY_MS);
    return instance;
  }
  instance = MemWal.create({
    key: required("MEMWAL_PRIVATE_KEY", "Walrus Memory"),
    accountId: required("MEMWAL_ACCOUNT_ID", "Walrus Memory"),
    serverUrl: cfg.MEMWAL_SERVER_URL,
    recallTimeoutMs: 25_000,
  });
  return instance;
}

/** Tests only: recall leaves out writes younger than `delayMs`, as Walrus indexing does. */
function withIndexDelay(port: MemoryPort, delayMs: number): MemoryPort {
  if (delayMs <= 0) return port;
  const writtenAt = new Map<string, number>();
  return {
    health: () => port.health(),
    getRememberBulkStatus: (ids) => port.getRememberBulkStatus(ids),
    rememberBulk: async (items, options) => {
      const now = Date.now();
      for (const item of items) writtenAt.set(item.text, now);
      return port.rememberBulk(items, options);
    },
    // Basket always calls recall with one params object.
    recall: (async (params: RecallParams) => {
      const result = await port.recall(params);
      const visible = result.results.filter((r) => Date.now() - (writtenAt.get(r.text) ?? 0) >= delayMs);
      return { ...result, results: visible, total: visible.length };
    }) as MemoryPort["recall"],
  };
}
