"use client";

import { useMemo, useState } from "react";
import { formatDay } from "@/domain/dates";
import { MIN_SPAN_DAYS, personalInflation, type Denomination } from "@/domain/inflation";
import { formatPercent } from "@/domain/money";
import { IndexChart } from "../charts/index-chart";
import { cx } from "../ui/cx";
import { Label, Panel } from "../ui/panel";
import { useBasket } from "./basket-provider";
import { ShareInflation } from "./share-inflation";

export function InflationPanel() {
  const { effective, home } = useBasket();
  const [denomination, setDenomination] = useState<Denomination>("local");
  const local = useMemo(() => personalInflation(effective, "local", home), [effective, home]);
  const usd = useMemo(() => personalInflation(effective, "usd", home), [effective, home]);
  const shown = denomination === "local" ? local : usd;
  const canShowUsd = local.currency !== "USD" && usd.changeRatio !== null;

  if (local.changeRatio === null) {
    return (
      <Panel>
        <Label>Your basket inflation</Label>
        <p className="mt-2 text-title">Not measured yet</p>
        <p className="mt-2 max-w-[60ch] text-muted">
          Basket measures inflation on the things you buy more than once. It needs the same item on two receipts at least {MIN_SPAN_DAYS} days apart. Older receipts count too.
        </p>
      </Panel>
    );
  }

  const change = shown.changeRatio ?? 0;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Label>Your basket inflation, {denomination === "local" ? `in ${local.currency}` : "in US dollars"}</Label>
          <p className={cx("mt-2 text-[3rem] leading-none font-medium tracking-[-0.03em] sm:text-display", change > 0 ? "text-rise" : change < 0 ? "text-fall" : "")}>
            {formatPercent(change)}
          </p>
          <p className="mt-3 max-w-[56ch] text-muted">
            Since {formatDay(shown.sinceDate!, { year: true })}, across {shown.itemsTracked} {shown.itemsTracked === 1 ? "item" : "items"} you buy repeatedly, weighted by what you spend on each.
          </p>
        </div>
        {canShowUsd ? (
          <div role="radiogroup" aria-label="Currency" className="inline-flex rounded-sm border border-line bg-ground p-1">
            {(["local", "usd"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={denomination === d}
                onClick={() => setDenomination(d)}
                className={cx("h-9 rounded-[7px] px-4 text-sm font-medium transition-colors", denomination === d ? "bg-ink text-ground" : "text-muted hover:text-ink")}
              >
                {d === "local" ? local.currency : "USD"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {canShowUsd && denomination === "local" && usd.changeRatio !== null ? (
        <p className="mt-4 text-soft">
          {Math.abs(usd.changeRatio - change) < 0.005
            ? `Measured in dollars the basket moved the same, ${formatPercent(usd.changeRatio)}: the exchange rate held while you shopped.`
            : `Measured in dollars, the same basket moved ${formatPercent(usd.changeRatio)}. The difference is the exchange rate's doing.`}
        </p>
      ) : null}
      {shown.series.length >= 2 ? (
        <div className="mt-8">
          <IndexChart points={shown.series} label={`Basket index in ${denomination === "local" ? local.currency : "USD"}`} />
        </div>
      ) : null}
      <div className="mt-6 border-t border-line pt-6">
        <ShareInflation card={{ r: local.changeRatio, u: canShowUsd && usd.changeRatio !== null ? usd.changeRatio : null, c: local.currency, s: local.sinceDate!, n: local.itemsTracked }} />
      </div>
    </Panel>
  );
}
