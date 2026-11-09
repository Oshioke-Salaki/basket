import type { Metadata } from "next";
import { ReceiptView } from "@/components/views/receipt-view";

export const metadata: Metadata = { title: "Receipt" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <ReceiptView />;
}
