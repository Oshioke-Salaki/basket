import { isCurrencyCode } from "@/domain/money";
import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { rate } from "@/server/tatum/rates";
import type { RatesPayload } from "@/lib/api-types";

/** Today's USD value of up to ten currencies, from Tatum's Data API. */
export const GET = route(async (request: Request) => {
  const codes = [...new Set((new URL(request.url).searchParams.get("currencies") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (codes.length === 0 || codes.length > 10 || !codes.every(isCurrencyCode)) throw new AppError("bad_request", "Ask for between 1 and 10 ISO currency codes.");
  const results = await Promise.allSettled(codes.map((c) => rate(c, "USD")));
  const usdPerUnit: Record<string, number> = {};
  let asOf: string | null = null;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      usdPerUnit[codes[i]!] = r.value.value;
      asOf = asOf && asOf > r.value.asOf ? asOf : r.value.asOf;
    }
  });
  const payload: RatesPayload = { usdPerUnit, asOf, missing: codes.filter((c) => !(c in usdPerUnit)) };
  return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
});
