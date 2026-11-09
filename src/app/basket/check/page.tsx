import type { Metadata } from "next";
import { CheckView } from "@/components/views/check-view";

export const metadata: Metadata = { title: "Price check" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <CheckView />;
}
