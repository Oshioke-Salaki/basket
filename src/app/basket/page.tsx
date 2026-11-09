import type { Metadata } from "next";
import { OverviewView } from "@/components/views/overview-view";

export const metadata: Metadata = { title: "Overview" };

/** Recalled from Walrus in the browser after load, so the page waits on client data by design. */
export const instant = false;

export default function Page() {
  return <OverviewView />;
}
