import type { Metadata } from "next";
import { StartFlow } from "@/components/start/start-flow";
import { Mark } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Start your basket" };

export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-svh w-[min(100%-48px,560px)] flex-col justify-center gap-10 py-16">
      <a href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight">
        <Mark className="text-action" />
        Basket
      </a>
      <StartFlow />
    </main>
  );
}
