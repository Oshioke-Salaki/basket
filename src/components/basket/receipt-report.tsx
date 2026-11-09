"use client";

import { useMemo, useState } from "react";
import { formatDay } from "@/domain/dates";
import { analyzeReceipt, type Finding } from "@/domain/findings";
import type { Lesson } from "@/domain/lessons";
import { formatMoney } from "@/domain/money";
import type { Receipt } from "@/domain/receipt";
import { formatSize } from "@/domain/units";
import { shortId, suiCheckpointUrl, walrusBlobUrl } from "@/lib/links";
import { ExternalLink } from "../ui/button";
import { cx } from "../ui/cx";
import { Sparkle } from "../ui/icons";
import { Label, Panel, PanelHeader } from "../ui/panel";
import { Spinner } from "../ui/spinner";
import { Tag } from "../ui/tag";
import { useBasket } from "./basket-provider";
import { describeFinding } from "./describe";

type Mode = "memory" | "blank";

/**
 * One receipt judged against everything the household bought before it. The
 * memory switch replays the same receipt with no history, which is what any
 * app without memory could tell you.
 */
export function ReceiptReport({ receipt, learned, isNew }: { receipt: Receipt; learned: readonly Lesson[]; isNew: boolean }) {
  const { effective } = useBasket();
  const [mode, setMode] = useState<Mode>("memory");
  const current = effective.find((r) => r.id === receipt.id) ?? receipt;
  const analysis = useMemo(
    () => (mode === "memory" ? analyzeReceipt(current, effective) : analyzeReceipt(current, [current])),
    [mode, current, effective],
  );
  const money = (minor: number) => formatMoney(minor, receipt.currency);
  const byLine = new Map<number, Finding[]>();
  for (const f of analysis.findings) byLine.set(f.lineIndex, [...(byLine.get(f.lineIndex) ?? []), f]);
  const earlier = effective.filter((r) => r.id !== receipt.id && r.purchasedOn <= receipt.purchasedOn).length;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label>{isNew ? "Just scanned" : "Receipt"}</Label>
          <h1 className="mt-2 text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">{receipt.store.name}</h1>
          <p className="mt-2 text-muted">
            {formatDay(receipt.purchasedOn, { year: true })} · {receipt.lines.length} items · {money(receipt.totalMinor)}
          </p>
        </div>
        <MemorySwitch mode={mode} onChange={setMode} />
      </header>

      <Panel className={cx(mode === "blank" && "border-dashed")}>
        <Summary analysis={analysis} currency={receipt.currency} mode={mode} earlier={earlier} />
      </Panel>

      <Panel className="p-0 sm:p-0">
        <h2 className="sr-only">Items on this receipt</h2>
        <ul>
          {receipt.lines.map((line, i) => {
            const findings = byLine.get(i) ?? [];
            return (
              <li key={i} className="grid gap-3 border-b border-line px-6 py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:px-8">
                <div className="min-w-0">
                  <p className="font-medium">
                    {current.lines[i]?.itemName ?? line.itemName}
                    {line.size ? <span className="text-muted"> · {formatSize(line.size)}</span> : null}
                    {line.quantity !== 1 ? <span className="text-muted"> × {line.quantity}</span> : null}
                  </p>
                  <p className="mt-0.5 font-mono text-[13px] text-muted">{line.raw}</p>
                  {findings.length ? (
                    <ul className="mt-3 grid gap-2">
                      {findings.map((f) => {
                        const view = describeFinding(f, receipt.currency);
                        return (
                          <li key={f.kind} className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-3">
                            <Tag tone={view.tone} icon={view.icon}>
                              {view.tag}
                            </Tag>
                            <span className="text-[15px] text-soft">{view.sentence}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
                <p className="text-lg font-medium sm:text-right">{money(line.totalMinor)}</p>
              </li>
            );
          })}
        </ul>
      </Panel>

      {learned.length > 0 ? (
        <Panel>
          <PanelHeader title={`Basket learned ${learned.length} ${learned.length === 1 ? "thing" : "things"} from this receipt`}>
            Each one is written to Walrus Memory with the receipt, so the next scan starts from here.
          </PanelHeader>
          <ul className="grid gap-3">
            {learned.map((l) => (
              <li key={`${l.key}-${l.learnedAt}`} className="flex gap-3 text-soft">
                <Sparkle className="mt-1 size-4 shrink-0 text-action" />
                {l.text}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Provenance receipt={receipt} />
    </div>
  );
}

function MemorySwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: "memory", label: "With memory" },
    { value: "blank", label: "Without memory" },
  ];
  return (
    <div role="radiogroup" aria-label="Judge this receipt" className="inline-flex rounded-sm border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 rounded-[7px] px-4 text-sm font-medium transition-colors",
            mode === o.value ? "bg-ink text-ground" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Summary({ analysis, currency, mode, earlier }: { analysis: ReturnType<typeof analyzeReceipt>; currency: string; mode: Mode; earlier: number }) {
  const money = (minor: number) => formatMoney(Math.abs(minor), currency);
  const rises = analysis.findings.filter((f) => f.kind === "above_usual").length;
  const shrinks = analysis.findings.filter((f) => f.kind === "shrinkflation").length;

  if (mode === "blank") {
    return (
      <div>
        <p className="text-lead">Without memory, every item is new.</p>
        <p className="mt-2 max-w-[62ch] text-muted">
          This is all an app without memory could say about this receipt: a list of prices with nothing to compare them to. Switch back to see what Basket knows from {earlier} earlier {earlier === 1 ? "receipt" : "receipts"}.
        </p>
      </div>
    );
  }
  if (analysis.knownLines === 0 && shrinks === 0) {
    return (
      <div>
        <p className="text-lead">Every price here is now remembered.</p>
        <p className="mt-2 max-w-[62ch] text-muted">These items are new to Basket. Scan your next shop and it will tell you whether each one went up, down or is cheaper somewhere else.</p>
      </div>
    );
  }
  const net = analysis.netDifferenceMinor;
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div>
        <Label>Against your usual prices</Label>
        <p className={cx("mt-1 text-[2rem] leading-tight font-medium tracking-tight", net > 0 ? "text-rise" : net < 0 ? "text-fall" : "")}>
          {net === 0 ? "On usual" : `${money(net)} ${net > 0 ? "more" : "less"}`}
        </p>
        <p className="text-sm text-muted">
          across {analysis.knownLines} of {analysis.totalLines} items Basket knew
        </p>
      </div>
      <div>
        <Label>Price rises</Label>
        <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{rises + shrinks}</p>
        <p className="text-sm text-muted">{shrinks ? `including ${shrinks} smaller ${shrinks === 1 ? "pack" : "packs"}` : "items above their usual"}</p>
      </div>
      <div>
        <Label>Cheaper elsewhere</Label>
        <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{analysis.couldSaveMinor > 0 ? money(analysis.couldSaveMinor) : "None"}</p>
        <p className="text-sm text-muted">at stores you have used recently</p>
      </div>
    </div>
  );
}

/** Where this receipt lives: its Walrus blob and the Sui checkpoint it was written at. */
function Provenance({ receipt }: { receipt: Receipt }) {
  const { blobFor } = useBasket();
  const job = blobFor(receipt.id);
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
      {job ? (
        job.blobId ? (
          <span>
            Stored on Walrus as blob <ExternalLink href={walrusBlobUrl(job.blobId)}>{shortId(job.blobId, 8, 6)}</ExternalLink>
          </span>
        ) : job.state === "failed" ? (
          <span className="text-rise">The Walrus write failed. Scan the receipt again to retry.</span>
        ) : job.state === "slow" ? (
          <span>Walrus is still confirming this write. It will appear on the Memory page once it lands.</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-3.5 text-action" label="Writing to Walrus" /> Writing to Walrus Memory on mainnet
          </span>
        )
      ) : (
        <span>Recalled from Walrus Memory</span>
      )}
      {receipt.checkpoint ? (
        <span>
          Committed at Sui checkpoint <ExternalLink href={suiCheckpointUrl(receipt.checkpoint)}>{Number(receipt.checkpoint).toLocaleString("en")}</ExternalLink>, read through Tatum
        </span>
      ) : null}
    </div>
  );
}
