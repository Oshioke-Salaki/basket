import "server-only";
import { AppError } from "./errors";
import { parsePending, type Pending } from "@/domain/pending";
import type { InputImage } from "./vision/models/port";
import { sniffImageType } from "./vision/image";

/** Largest photo accepted. The browser downsizes before upload, so this is a guard, not a target. */
const MAX_BYTES = 4 * 1024 * 1024;

/** The `image` field of a multipart request, checked by size and by its bytes, and any pending records. */
export async function imageFromForm(request: Request): Promise<InputImage & { pending: Pending }> {
  const form = await request.formData().catch(() => {
    throw new AppError("bad_request", "Send the photo as multipart form data.");
  });
  const pending = parsePending(form.get("pending"));
  const file = form.get("image");
  if (!(file instanceof File)) throw new AppError("bad_request", "Attach a photo.");
  if (file.size > MAX_BYTES) throw new AppError("payload_too_large", "That photo is over 4 MB. Try again; Basket shrinks photos before sending them.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) throw new AppError("bad_request", "Use a JPEG, PNG or WebP photo.");
  return { bytes, mediaType, pending };
}
