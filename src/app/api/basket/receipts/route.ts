import { route } from "@/server/http";
import { imageFromForm } from "@/server/http-image";
import { scanReceipt } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import type { ScanPayload } from "@/lib/api-types";

export const maxDuration = 120;

export const POST = route(async (request: Request) => {
  const household = await requireHousehold({ write: true });
  const result = await scanReceipt(household, await imageFromForm(request));
  const payload: ScanPayload = result;
  return Response.json(payload, { status: result.duplicateOf ? 200 : 201 });
});
