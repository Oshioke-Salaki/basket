import { z } from "zod";
import { AppError } from "@/server/errors";
import { readJson, route } from "@/server/http";
import { closeBasket, currentBasketKey, newBasketKey, openBasket, openDemoBasket } from "@/server/session";
import type { SessionPayload } from "@/lib/api-types";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("new") }),
  z.object({ action: z.literal("open"), key: z.string().trim().min(1).max(64) }),
  z.object({ action: z.literal("demo") }),
]);

export const POST = route(async (request: Request) => {
  const body = await readJson(request, (v) => {
    const parsed = Body.safeParse(v);
    if (!parsed.success) throw new AppError("bad_request", "Unknown session action.");
    return parsed.data;
  });
  let payload: SessionPayload;
  switch (body.action) {
    case "new": {
      const key = newBasketKey();
      await openBasket(key);
      payload = { key, isDemo: false };
      break;
    }
    case "open":
      await openBasket(body.key.toLowerCase());
      payload = { key: null, isDemo: false };
      break;
    case "demo":
      await openDemoBasket();
      payload = { key: null, isDemo: true };
      break;
  }
  return Response.json(payload);
});

/** The current basket key, so the household can copy it to another device. */
export const GET = route(async () => {
  const key = await currentBasketKey();
  if (!key) throw new AppError("unauthorized", "No basket is open in this browser.");
  return Response.json({ key }, { headers: { "Cache-Control": "no-store" } });
});

export const DELETE = route(async () => {
  await closeBasket();
  return new Response(null, { status: 204 });
});
