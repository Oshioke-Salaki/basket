import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { scanReceipt } from "@/server/services/basket";
import { requireHousehold } from "@/server/session";
import { sniffImageType } from "@/server/vision/image";
import type { ScanPayload } from "@/lib/api-types";

export const maxDuration = 120;

/** Largest photo accepted. The browser downsizes before upload, so this is a guard, not a target. */
const MAX_BYTES = 4 * 1024 * 1024;

export const POST = route(async (request: Request) => {
  const household = await requireHousehold({ write: true });
  const form = await request.formData().catch(() => {
    throw new AppError("bad_request", "Send the receipt photo as multipart form data.");
  });
  const file = form.get("image");
  if (!(file instanceof File)) throw new AppError("bad_request", "Attach a receipt photo.");
  if (file.size > MAX_BYTES) throw new AppError("payload_too_large", "That photo is over 4 MB. Try again; Basket shrinks photos before sending them.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) throw new AppError("bad_request", "Use a JPEG, PNG or WebP photo of the receipt.");

  const result = await scanReceipt(household, { bytes, mediaType });
  const payload: ScanPayload = result;
  return Response.json(payload, { status: result.duplicateOf ? 200 : 201 });
});
