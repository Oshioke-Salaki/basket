import type { Metadata } from "next";
import { MemoryView } from "@/components/views/memory-view";

export const metadata: Metadata = { title: "Memory" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <MemoryView />;
}
