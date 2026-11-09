import type { Metadata } from "next";
import { ItemView } from "@/components/views/item-view";

export const metadata: Metadata = { title: "Item" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <ItemView />;
}
