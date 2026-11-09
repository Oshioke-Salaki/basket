"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBasket } from "@/components/basket/basket-provider";
import { EmptyBasket } from "@/components/basket/empty-basket";
import { InflationPanel } from "@/components/basket/inflation-panel";
import { LessonsList } from "@/components/basket/lessons-list";
import { MoversPanel, StoresPanel } from "@/components/basket/movers-panel";
import { RunwayPanel } from "@/components/basket/runway-panel";
import { TextLink } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatDay } from "@/domain/dates";
import { currentLessons } from "@/domain/lessons";
import { formatMoney } from "@/domain/money";

export default function OverviewPage() {
  const { receipts, lessons, effective, isDemo } = useBasket();
  const latest = useMemo(() => currentLessons(lessons).slice(0, 4), [lessons]);
  const recent = useMemo(() => [...receipts].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn)).slice(0, 4), [receipts]);
  if (receipts.length === 0) return <EmptyBasket />;
  const items = new Set(effective.flatMap((r) => r.lines.map((l) => l.itemKey))).size;

  return (
    <div className="grid gap-6">
      <header className="mb-2">
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">{isDemo ? "The demo household" : "Your basket"}</h1>
        <p className="mt-2 text-muted">
          {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"}, {items} items and {lessons.length} lessons, all remembered on Walrus Memory.
        </p>
      </header>

      <InflationPanel />

      <div className="grid gap-6 lg:grid-cols-2">
        <MoversPanel />
        <StoresPanel />
      </div>

      <RunwayPanel />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="What Basket learned" aside={<TextLink href="/basket/memory">All memory</TextLink>} />
          {latest.length ? <LessonsList lessons={latest} /> : <p className="text-muted">Lessons appear once an item has been bought twice.</p>}
        </Panel>
        <Panel>
          <PanelHeader title="Latest receipts" aside={<TextLink href="/basket/receipts">All receipts</TextLink>} />
          <ul>
            {recent.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <Link href={`/basket/receipts/${r.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-action">
                  <span className="min-w-0 truncate">
                    {r.store.name} <span className="text-muted">· {formatDay(r.purchasedOn)}</span>
                  </span>
                  <span className="shrink-0 font-medium">{formatMoney(r.totalMinor, r.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
