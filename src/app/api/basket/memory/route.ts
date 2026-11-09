import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { memoryStatus } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { MemoryStatusPayload } from "@/lib/api-types";

const JOB_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Where the household's latest writes are on their way to Walrus. */
export const GET = route(async (request: Request) => {
  const household = await requireHousehold();
  const ids = (new URL(request.url).searchParams.get("jobs") ?? "").split(",").filter(Boolean);
  if (ids.length === 0 || ids.length > 40 || !ids.every((id) => JOB_ID.test(id))) {
    throw new AppError("bad_request", "Pass between 1 and 40 memory job ids.");
  }
  const payload: MemoryStatusPayload = { jobs: await memoryStatus(household, ids) };
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
});
