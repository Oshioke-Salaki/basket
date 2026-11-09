import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { openDemoBasket } from "@/server/session";

/** Open the public demo household (read-only) and go straight to it. */
export async function GET() {
  await connection();
  try {
    await openDemoBasket();
  } catch (error) {
    unstable_rethrow(error);
    redirect("/start");
  }
  redirect("/basket");
}
