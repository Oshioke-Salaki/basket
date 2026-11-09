import { redirect } from "next/navigation";
import { AppError } from "@/server/errors";
import { openDemoBasket } from "@/server/session";

/** Open the public demo household (read-only) and go straight to it. */
export async function GET() {
  try {
    await openDemoBasket();
  } catch (error) {
    if (error instanceof AppError) redirect("/start");
    throw error;
  }
  redirect("/basket");
}
