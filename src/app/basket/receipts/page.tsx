import type { Metadata } from "next";
import { ReceiptsView } from "@/components/views/receipts-view";

export const metadata: Metadata = { title: "Receipts" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <ReceiptsView />;
}
