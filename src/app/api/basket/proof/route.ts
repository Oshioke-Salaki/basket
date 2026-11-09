import { config } from "@/server/config";
import { route } from "@/server/http";
import { memoryProof } from "@/server/services/proof";
import { requireHousehold } from "@/server/session";
import type { ProofPayload } from "@/lib/api-types";

export const maxDuration = 60;

/** The Walrus Memory account behind this basket, read from Sui mainnet through Tatum. */
export const GET = route(async () => {
  const household = await requireHousehold();
  const proof = await memoryProof(household, config().MEMWAL_SERVER_URL);
  const payload: ProofPayload = {
    account: { objectId: proof.account.objectId, type: proof.account.type, version: proof.account.version, owner: proof.account.owner },
    checkpoint: proof.checkpoint,
    namespaces: proof.namespaces,
    relayer: proof.relayer,
  };
  return Response.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
});
