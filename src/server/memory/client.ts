import "server-only";
import { MemWal, MemWalMock } from "@mysten-incubation/memwal";
import { config, required } from "../config";
import type { MemoryPort } from "./port";

let instance: MemoryPort | null = null;

/** One Walrus Memory client per server process; namespaces carry the household. */
export function memoryClient(): MemoryPort {
  if (instance) return instance;
  const cfg = config();
  if (cfg.BASKET_FAKE_SERVICES) {
    instance = MemWalMock.create({ namespace: "basket-fake" }) as unknown as MemoryPort;
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
