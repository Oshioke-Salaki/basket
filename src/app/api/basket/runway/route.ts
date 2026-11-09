import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { walletRunway } from "@/server/services/runway";
import { requireHousehold } from "@/server/session";
import type { RunwayPayload } from "@/lib/api-types";

export const maxDuration = 60;

/** Read a Sui wallet's SUI and USDC through Tatum and express it in weeks of groceries. */
export const GET = route(async (request: Request) => {
  const household = await requireHousehold();
  const address = new URL(request.url).searchParams.get("address");
  if (!address) throw new AppError("bad_request", "Enter a Sui address.");
  const payload: RunwayPayload = await walletRunway(household, address);
  return Response.json(payload, { headers: { "Cache-Control": "private, max-age=60" } });
});
