"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { prepareReceiptImage, UnsupportedImageError } from "@/lib/image";
import { useBasket } from "../basket/basket-provider";
import { Button, buttonClass } from "../ui/button";
import { cx } from "../ui/cx";
import { Camera, Check } from "../ui/icons";
import { Panel } from "../ui/panel";
import { Spinner } from "../ui/spinner";

type Phase = { kind: "idle" } | { kind: "working"; step: number; preview: string } | { kind: "failed"; message: string; preview: string | null };

/** What happens after the photo leaves the phone, in the order it happens. */
const STEPS = [
  "Reading the receipt",
  "Matching items to what you have bought before",
  "Comparing each price with your history",
  "Writing the receipt and what Basket learned to Walrus Memory",
] as const;

/** Rough timings so the narration keeps pace with the real request. */
const STEP_AFTER_MS = [0, 9_000, 16_000, 21_000];

export function ScanFlow() {
  const { scan, receipts, readOnly } = useBasket();
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function handle(file: File | undefined) {
    if (!file || phase.kind === "working") return;
    const preview = URL.createObjectURL(file);
    setPhase({ kind: "working", step: 0, preview });
    timers.current = STEP_AFTER_MS.slice(1).map((ms, i) => setTimeout(() => setPhase((p) => (p.kind === "working" ? { ...p, step: i + 1 } : p)), ms));
    try {
      const image = await prepareReceiptImage(file);
      const result = await scan(image);
      timers.current.forEach(clearTimeout);
      router.push(`/basket/receipts/${result.receipt.id}${result.duplicateOf ? "?duplicate=1" : "?new=1"}`);
    } catch (error) {
      timers.current.forEach(clearTimeout);
      const message =
        error instanceof UnsupportedImageError || error instanceof ApiError ? error.message : "Something went wrong while reading the receipt. Try again.";
      setPhase({ kind: "failed", message, preview });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  if (readOnly) {
    return (
      <Panel>
        <p className="text-lead">The demo basket is read-only.</p>
        <p className="mt-2 text-muted">Start your own basket to scan receipts. It takes one click and no sign-up.</p>
        <a href="/start" className={buttonClass("primary", "mt-6")}>
          Start your basket
        </a>
      </Panel>
    );
  }

  if (phase.kind === "working") {
    return (
      <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr] md:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL preview */}
        <img src={phase.preview} alt="The receipt being read" className="max-h-[420px] w-full rounded-md border border-line object-contain" />
        <ol className="grid gap-5" aria-live="polite">
          {STEPS.map((label, i) => (
            <li key={label} className={cx("flex items-start gap-3", i > phase.step && "text-muted")}>
              <span className="mt-1 grid size-5 place-items-center">
                {i < phase.step ? <Check className="size-5 text-action" /> : i === phase.step ? <Spinner className="size-4 text-action" label={label} /> : <span className="size-1.5 rounded-full bg-muted" />}
              </span>
              <span className={cx(i === phase.step && "text-ink")}>{label}</span>
            </li>
          ))}
          <li className="text-sm text-muted">This usually takes 20 to 40 seconds.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {phase.kind === "failed" ? (
        <div role="alert" className="rounded-md border border-rise/40 bg-rise/10 px-5 py-4">
          <p className="font-medium text-rise">That receipt could not be read</p>
          <p className="mt-1 text-soft">{phase.message}</p>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cx(
          "flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-action bg-action/5" : "border-line-strong bg-surface hover:border-ink/40",
        )}
      >
        <Camera className="size-8 text-action" />
        <span className="text-lead font-medium">Take a photo of a receipt</span>
        <span className="max-w-[44ch] text-muted">Lay it flat in good light with every price in frame. On a computer, drop a photo here or choose a file.</span>
        <span className={buttonClass("primary", "pointer-events-none mt-2")}>Choose a photo</span>
      </label>
      <input ref={input} id={inputId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void handle(e.target.files?.[0])} />

      {receipts.length === 0 ? (
        <p className="text-muted">Your first receipt teaches Basket your prices. From the second one on, it tells you what went up, what shrank and where it was cheaper.</p>
      ) : (
        <p className="text-muted">
          Basket will compare it with {receipts.length} remembered {receipts.length === 1 ? "receipt" : "receipts"}. Older receipts are welcome too: the date printed on each one is what counts.
        </p>
      )}
      {phase.kind === "failed" ? (
        <Button variant="secondary" className="justify-self-start" onClick={() => setPhase({ kind: "idle" })}>
          Clear the error
        </Button>
      ) : null}
    </div>
  );
}
