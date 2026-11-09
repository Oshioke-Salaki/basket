import { z } from "zod";
import { AppError } from "@/server/errors";
import { readJson, route } from "@/server/http";
import { mergeItems } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { MergePayload } from "@/lib/api-types";

const key = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const Body = z.object({ from: key, into: key });

/** The household says two item names are one product. */
export const POST = route(async (request: Request) => {
  const household = await requireHousehold({ write: true });
  const { from, into } = await readJson(request, (v) => {
    const parsed = Body.safeParse(v);
    if (!parsed.success) throw new AppError("bad_request", "Name the two items to join.");
    return parsed.data;
  });
  const payload: MergePayload = await mergeItems(household, from, into);
  return Response.json(payload, { status: 201 });
});
