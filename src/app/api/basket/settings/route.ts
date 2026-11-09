import { z } from "zod";
import { isCurrencyCode } from "@/domain/money";
import { AppError } from "@/server/errors";
import { readJson, route } from "@/server/http";
import { setHomeCurrency } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { MergePayload } from "@/lib/api-types";

const Body = z.object({ homeCurrency: z.string().trim().toUpperCase().refine(isCurrencyCode, "an ISO 4217 code") });

/** The household's home currency, stored as a memory on Walrus. */
export const POST = route(async (request: Request) => {
  const household = await requireHousehold({ write: true });
  const { homeCurrency } = await readJson(request, (v) => {
    const parsed = Body.safeParse(v);
    if (!parsed.success) throw new AppError("bad_request", "Choose a currency from the list.");
    return parsed.data;
  });
  const payload: MergePayload = await setHomeCurrency(household, homeCurrency);
  return Response.json(payload, { status: 201 });
});
