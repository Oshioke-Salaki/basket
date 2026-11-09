"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { buttonClass } from "../ui/button";
import { Spinner } from "../ui/spinner";

/**
 * Open a basket from a link or QR code. The key travels in the URL fragment,
 * which browsers never send to a server, and is cleared from the address bar at once.
 */
export function OpenFromLink() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = decodeURIComponent(window.location.hash.slice(1)).trim();
    window.history.replaceState(null, "", window.location.pathname);
    if (!key) {
      queueMicrotask(() => setError("This link has no basket key in it."));
      return;
    }
    api
      .openBasket(key)
      .then(() => router.replace("/basket"))
      .catch((e) => setError(e instanceof ApiError ? e.message : "The basket could not be opened."));
  }, [router]);

  if (error) {
    return (
      <section className="grid gap-4">
        <h1 className="text-title">That basket did not open</h1>
        <p className="text-soft">{error}</p>
        <a href="/start" className={buttonClass("secondary", "justify-self-start")}>
          Open with a key instead
        </a>
      </section>
    );
  }
  return (
    <p className="flex items-center gap-3 text-lead" aria-live="polite">
      <Spinner className="text-action" label="Opening the basket" /> Opening the shared basket
    </p>
  );
}
