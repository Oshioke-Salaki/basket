import "server-only";
import { config, required } from "../config";
import type { Household } from "../session";
import { latestCheckpoint, objectOf, type ChainObject, type Checkpoint } from "../tatum/sui";

const FAKE_ACCOUNT = `0x${"f".repeat(64)}`;

export interface MemoryProof {
  readonly account: ChainObject;
  readonly checkpoint: Checkpoint;
  readonly namespaces: { readonly receipts: string; readonly lessons: string };
  readonly relayer: string;
}

/** Where this basket's memory lives on Sui mainnet, read live through Tatum. */
export async function memoryProof(household: Household, relayer: string): Promise<MemoryProof> {
  const accountId = config().BASKET_FAKE_SERVICES ? FAKE_ACCOUNT : required("MEMWAL_ACCOUNT_ID", "Walrus Memory");
  const [account, checkpoint] = await Promise.all([objectOf(accountId), latestCheckpoint()]);
  return {
    account,
    checkpoint,
    namespaces: { receipts: `${household.namespace}-receipts`, lessons: `${household.namespace}-lessons` },
    relayer,
  };
}
