import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { walletValue } from "@/server/services/runway";
import { requireHousehold } from "@/server/session";

export const maxDuration = 60;

/** Read a Sui wallet's SUI and USDC through Tatum, valued in the household's currency. */
export const GET = route(async (request: Request) => {
  await requireHousehold();
  const params = new URL(request.url).searchParams;
  const address = params.get("address");
  const currency = params.get("currency");
  if (!address) throw new AppError("bad_request", "Enter a Sui address.");
  if (!currency) throw new AppError("bad_request", "Pass the household's currency.");
  return Response.json(await walletValue(address, currency), { headers: { "Cache-Control": "private, max-age=60" } });
});
