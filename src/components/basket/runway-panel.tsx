"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { formatMoney } from "@/domain/money";
import { weeklySpend } from "@/domain/spend";
import { api, ApiError } from "@/lib/api";
import type { RunwayPayload } from "@/lib/api-types";
import { shortId, suiAccountUrl } from "@/lib/links";
import { Button, ExternalLink } from "../ui/button";
import { Label, Panel, PanelHeader } from "../ui/panel";
import { Spinner } from "../ui/spinner";
import { useBasket } from "./basket-provider";

const STORAGE_KEY = "basket:runway-address";
const usd = (v: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(v);

/** The last address used on this device, a per-viewer convenience only. */
function readSavedAddress(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

const subscribeToNothing = () => () => {};

/** Weekly grocery spend, and how many weeks of it a Sui wallet’s SUI and USDC would cover. */
export function RunwayPanel() {
  const { effective, home, rates } = useBasket();
  const spend = useMemo(() => weeklySpend(effective, home, rates), [effective, home, rates]);
  const fieldId = useId();
  const errorId = useId();
  const saved = useSyncExternalStore(subscribeToNothing, readSavedAddress, () => "");
  const [typed, setAddress] = useState<string | null>(null);
  const address = typed ?? saved;
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; report: RunwayPayload } | { kind: "error"; message: string }>({ kind: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = address.trim();
    if (!value) {
      setState({ kind: "error", message: "Write a Sui address, starting with 0x." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const report = await api.runway(value, spend!.currency);
      setState({ kind: "done", report });
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {}
    } catch (error) {
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "The wallet could not be read. Try again." });
    }
  }

  if (!spend) return null;
  const money = (minor: number) => formatMoney(minor, spend.currency);

  return (
    <Panel>
      <PanelHeader title="Groceries in weeks">Your average week of groceries, and how long a Sui wallet’s SUI and USDC would keep buying it.</PanelHeader>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <Label>Your average week</Label>
          <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{money(spend.weeklyMinor)}</p>
          <p className="text-sm text-muted">
            from {spend.receipts} {spend.receipts === 1 ? "receipt" : "receipts"} over {spend.weeksObserved} {spend.weeksObserved === 1 ? "week" : "weeks"}
            {spend.unconverted ? `, leaving out ${spend.unconverted} without an exchange rate` : ""}
          </p>
        </div>
        <div>
          <form onSubmit={submit} noValidate className="grid gap-2">
            <label htmlFor={fieldId} className="text-sm font-medium text-soft">
              Sui wallet address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={fieldId}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={state.kind === "error" || undefined}
                aria-describedby={state.kind === "error" ? errorId : undefined}
                className="h-12 min-w-0 flex-1 rounded-sm border border-line-strong bg-ground px-4 font-mono text-[15px] text-ink placeholder:text-muted focus:border-action focus:outline-none"
              />
              <Button type="submit" variant="secondary" className="h-12" disabled={state.kind === "loading"}>
                {state.kind === "loading" ? <Spinner label="Reading the wallet" /> : null}
                Count the weeks
              </Button>
            </div>
            {state.kind === "error" ? (
              <p id={errorId} className="text-sm text-rise">
                {state.message}
              </p>
            ) : (
              <p className="text-sm text-muted">Read-only. Balances come from Sui mainnet through Tatum; nothing is signed or sent.</p>
            )}
          </form>
          {state.kind === "done" ? <RunwayResult report={state.report} weeklyMinor={spend.weeklyMinor} /> : null}
        </div>
      </div>
    </Panel>
  );
}

function RunwayResult({ report, weeklyMinor }: { report: RunwayPayload; weeklyMinor: number }) {
  const money = (minor: number) => formatMoney(minor, report.currency);
  const weeks = weeklyMinor > 0 ? report.holdingsMinor / weeklyMinor : 0;
  return (
    <div className="mt-6 border-t border-line pt-6" aria-live="polite">
      <p className="text-[2rem] leading-tight font-medium tracking-tight">
        {weeks >= 10 ? Math.round(weeks) : weeks.toFixed(1)} weeks <span className="text-muted">of your groceries</span>
      </p>
      <p className="mt-2 text-soft">
        {report.usdc.amount.toLocaleString("en", { maximumFractionDigits: 2 })} USDC and {report.sui.amount.toLocaleString("en", { maximumFractionDigits: 2 })} SUI come to {usd(report.totalUsd)}, or {money(report.holdingsMinor)} at today’s rate.
      </p>
      <p className="mt-2 text-sm text-muted">
        Wallet <ExternalLink href={suiAccountUrl(report.address)}>{shortId(report.address)}</ExternalLink> · SUI at {usd(report.rates.suiUsd)} · 1 {report.currency} = {usd(report.rates.usdPerUnit)} ({report.rates.source} via Tatum)
      </p>
    </div>
  );
}
