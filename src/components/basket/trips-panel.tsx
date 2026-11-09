"use client";

import { useMemo } from "react";
import { formatDay } from "@/domain/dates";
import { formatApprox, formatMoney } from "@/domain/money";
import { tripsOf } from "@/domain/trips";
import { cx } from "../ui/cx";
import { Panel, PanelHeader } from "../ui/panel";
import { useBasket } from "./basket-provider";

function times(ratio: number): string {
  if (ratio >= 1.05) return `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× your home price`;
  if (ratio <= 0.95) return `${Math.round((1 - ratio) * 100)}% under your home price`;
  return "about your home price";
}

/** Spending in other currencies, grouped into trips and priced against home. */
export function TripsPanel() {
  const { effective, home, rates } = useBasket();
  const trips = useMemo(() => (home ? tripsOf(effective, home, rates) : []), [effective, home, rates]);
  if (!home || trips.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="Trips abroad">
        Receipts in other currencies, grouped by trip, converted to {home} at the exchange rate recorded with each receipt, and priced against what you pay at home.
      </PanelHeader>
      <ul className="grid gap-6">
        {trips.map((trip) => (
          <li key={trip.id} className="rounded-md border border-line p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="font-medium">
                {trip.stores.slice(0, 3).join(", ")}
                {trip.stores.length > 3 ? ` and ${trip.stores.length - 3} more` : ""}
              </p>
              <p className="text-sm text-muted">
                {formatDay(trip.from, { year: true })}
                {trip.to !== trip.from ? ` to ${formatDay(trip.to, { year: true })}` : ""} · {trip.receipts.length} {trip.receipts.length === 1 ? "receipt" : "receipts"}
              </p>
            </div>
            <p className="mt-3 text-[1.5rem] leading-tight font-medium tracking-tight">
              {formatMoney(trip.totalMinor, trip.currency)}
              {trip.totalHomeMinor !== null ? <span className="text-muted"> ≈ {formatApprox(trip.totalHomeMinor, home)}</span> : null}
            </p>
            {trip.comparisons.length ? (
              <ul className="mt-4">
                {trip.comparisons.slice(0, 4).map((c) => (
                  <li key={c.itemKey} className="flex items-center justify-between gap-4 border-t border-line py-2.5">
                    <span className="min-w-0 truncate">{c.itemName}</span>
                    <span className={cx("shrink-0 text-sm font-medium", c.ratio >= 1.05 ? "text-rise" : c.ratio <= 0.95 ? "text-fall" : "text-muted")}>{times(c.ratio)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing on this trip matched an item you buy at home.</p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
