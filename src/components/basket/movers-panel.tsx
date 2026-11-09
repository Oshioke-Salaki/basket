"use client";

import Link from "next/link";
import { useMemo } from "react";
import { personalInflation } from "@/domain/inflation";
import { formatPercent } from "@/domain/money";
import { storeStandings } from "@/domain/stores";
import { cx } from "../ui/cx";
import { Panel, PanelHeader } from "../ui/panel";
import { useBasket } from "./basket-provider";

export function MoversPanel() {
  const { effective } = useBasket();
  const movers = useMemo(() => personalInflation(effective).movers.slice(0, 5), [effective]);
  return (
    <Panel>
      <PanelHeader title="Items driving it">The prices that moved your basket most, weighted by how much you spend on them.</PanelHeader>
      {movers.length === 0 ? (
        <p className="text-muted">Shown once an item has been bought twice.</p>
      ) : (
        <ul>
          {movers.map((m) => (
            <li key={m.itemKey} className="border-b border-line last:border-b-0">
              <Link href={`/basket/items/${m.itemKey}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-action">
                <span className="min-w-0 truncate">{m.itemName}</span>
                <span className={cx("shrink-0 font-medium", m.changeRatio > 0 ? "text-rise" : m.changeRatio < 0 ? "text-fall" : "text-muted")}>
                  {formatPercent(m.changeRatio)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function StoresPanel() {
  const { effective } = useBasket();
  const standings = useMemo(() => storeStandings(effective), [effective]);
  return (
    <Panel>
      <PanelHeader title="Stores for your basket">Each store's prices on the items you buy in more than one place.</PanelHeader>
      {standings.length < 2 ? (
        <p className="text-muted">Shown once you have shopped for the same items at two stores.</p>
      ) : (
        <ul>
          {standings.map((s, i) => (
            <li key={s.storeKey} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <span className="min-w-0">
                <span className="block truncate">
                  {s.storeName}
                  {i === 0 ? <span className="ml-2 text-label text-action">Cheapest</span> : null}
                </span>
                <span className="block text-sm text-muted">
                  {s.itemsCompared} shared items · {s.visits} {s.visits === 1 ? "visit" : "visits"}
                </span>
              </span>
              <span className={cx("shrink-0 font-medium", s.relativeRatio > 0.005 ? "text-rise" : s.relativeRatio < -0.005 ? "text-fall" : "text-muted")}>
                {Math.abs(s.relativeRatio) < 0.005 ? "Average" : `${formatPercent(s.relativeRatio)} vs average`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
