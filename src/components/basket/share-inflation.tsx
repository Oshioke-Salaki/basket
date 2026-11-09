"use client";

import { useState } from "react";
import { formatPercent } from "@/domain/money";
import { encodeShareCard, type ShareCard } from "@/domain/share";
import { Button } from "../ui/button";

/**
 * Share only the headline numbers: the device's share sheet where there is one,
 * else a post to X and a link to copy.
 */
export function ShareInflation({ card }: { card: ShareCard }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const url = () => `${window.location.origin}/share/${encodeShareCard(card)}`;
  const text = `My grocery inflation is ${formatPercent(card.r)}, measured from my own receipts with Basket. @Tatum_io @WalrusFoundation`;

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My grocery inflation", text, url: url() });
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    setOpen((o) => !o);
  }

  return (
    <div className="grid justify-items-start gap-3">
      <Button variant="secondary" onClick={() => void share()} aria-expanded={open}>
        Share my number
      </Button>
      {open ? (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <a className="text-action underline decoration-action/40 underline-offset-4" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`}>
            Post it on X
          </a>
          <button
            type="button"
            className="text-action underline decoration-action/40 underline-offset-4"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url());
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Link copied" : "Copy the link"}
          </button>
          <span className="text-muted">Only these numbers are shared, never your receipts.</span>
        </div>
      ) : null}
    </div>
  );
}
