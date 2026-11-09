import type { Metadata } from "next";
import { ScanFlow } from "@/components/scan/scan-flow";

export const metadata: Metadata = { title: "Scan a receipt" };

export default function ScanPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header>
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Scan a receipt</h1>
        <p className="mt-2 max-w-[56ch] text-muted">Basket reads every line, compares each price with what you paid before and remembers the receipt on Walrus.</p>
      </header>
      <ScanFlow />
    </div>
  );
}
