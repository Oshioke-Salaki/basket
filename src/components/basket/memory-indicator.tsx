"use client";

import Link from "next/link";
import { Check } from "../ui/icons";
import { Spinner } from "../ui/spinner";
import { useBasket } from "./basket-provider";

/** A live line in the header while writes are on their way to Walrus Memory. */
export function MemoryIndicator() {
  const { jobs } = useBasket();
  const all = Object.values(jobs);
  if (all.length === 0) return null;
  const pending = all.filter((j) => j.state === "pending" || j.state === "running" || j.state === "uploaded").length;
  const failed = all.filter((j) => j.state === "failed").length;

  return (
    <Link href="/basket/memory" className="hidden items-center gap-2 text-sm text-muted transition-colors hover:text-ink sm:flex" aria-live="polite">
      {pending > 0 ? (
        <>
          <Spinner className="size-3.5 text-action" label="Writing to Walrus" />
          Writing {pending} {pending === 1 ? "memory" : "memories"} to Walrus
        </>
      ) : failed > 0 ? (
        <span className="text-rise">{failed} {failed === 1 ? "write" : "writes"} failed</span>
      ) : (
        <>
          <Check className="size-4 text-action" />
          Saved on Walrus
        </>
      )}
    </Link>
  );
}
