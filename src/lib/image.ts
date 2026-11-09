/**
 * Phone photos are often 4 to 12 MB. Receipts read just as well at 2000 px on the
 * long edge, which keeps uploads under the server's 4 MB limit and fast on mobile data.
 */
const MAX_EDGE = 2000;
const PASS_THROUGH_BYTES = 1_500_000;
const PASS_THROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class UnsupportedImageError extends Error {}

export async function prepareReceiptImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new UnsupportedImageError("Choose a photo of the receipt (JPEG, PNG or WebP).");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnsupportedImageError("This browser cannot open that photo. Take it again as a JPEG, or use your phone's camera from the scan screen.");
  }
  const { width, height } = bitmap;
  const longEdge = Math.max(width, height);
  if (PASS_THROUGH_TYPES.has(file.type) && file.size <= PASS_THROUGH_BYTES && longEdge <= MAX_EDGE * 1.2) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new UnsupportedImageError("This browser cannot prepare the photo for upload.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new UnsupportedImageError("The photo could not be compressed for upload.");
  return blob;
}
