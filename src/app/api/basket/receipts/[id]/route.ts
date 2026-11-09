import { LineRevisionSchema } from "@/domain/revise";
import { AppError } from "@/server/errors";
import { readJson, route } from "@/server/http";
import { reviseLine } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { RevisionPayload } from "@/lib/api-types";

/** Correct one line of a receipt. The new version is written to Walrus Memory. */
export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/basket/receipts/[id]">) => {
  const household = await requireHousehold({ write: true });
  const { id } = await ctx.params;
  const revision = await readJson(request, (v) => {
    const parsed = LineRevisionSchema.safeParse(v);
    if (!parsed.success) throw new AppError("bad_request", "That correction is incomplete. Check the name, price and quantity.");
    return parsed.data;
  });
  const payload: RevisionPayload = await reviseLine(household, id, revision);
  return Response.json(payload);
});
