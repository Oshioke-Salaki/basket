import { route } from "@/server/http";
import { loadLedger } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { BasketPayload } from "@/lib/api-types";

export const maxDuration = 60;

/** Recall the household's receipts and lessons from Walrus Memory. */
export const GET = route(async (request: Request) => {
  const household = await requireHousehold();
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const ledger = await loadLedger(household, { fresh });
  const payload: BasketPayload = {
    receipts: ledger.receipts,
    lessons: ledger.lessons,
    degraded: ledger.degraded,
    readOnly: household.readOnly,
    isDemo: household.isDemo,
  };
  return Response.json(payload, { headers: { "Cache-Control": "private, no-store" } });
});
