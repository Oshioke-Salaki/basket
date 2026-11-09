import { route } from "@/server/http";
import { imageFromForm } from "@/server/http-image";
import { priceFromPhoto } from "@/server/services/price-tag";
import { requireHousehold } from "@/server/session";

export const maxDuration = 90;

/** Read a shelf or market price from a photo. Read-only: nothing is remembered. */
export const POST = route(async (request: Request) => {
  const household = await requireHousehold();
  const { pending, ...image } = await imageFromForm(request);
  return Response.json(await priceFromPhoto(household, image, pending));
});
