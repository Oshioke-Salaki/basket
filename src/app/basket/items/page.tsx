import type { Metadata } from "next";
import { ItemsView } from "@/components/views/items-view";

export const metadata: Metadata = { title: "Items" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <ItemsView />;
}
