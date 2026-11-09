import type { MemWal } from "@mysten-incubation/memwal";

/** The slice of the Walrus Memory client Basket depends on. MemWalMock satisfies it too. */
export type MemoryPort = Pick<MemWal, "rememberBulk" | "getRememberBulkStatus" | "recall" | "health">;
