"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBasket } from "@/components/basket/basket-provider";
import { EmptyBasket } from "@/components/basket/empty-basket";
import { Panel } from "@/components/ui/panel";
import { cx } from "@/components/ui/cx";
import { itemSummaries } from "@/domain/items";
import { formatMoney, formatPercent } from "@/domain/money";

export function ItemsView() {
  const { effective } = useBasket();
  const items = useMemo(() => itemSummaries(effective), [effective]);
  if (items.length === 0) return <EmptyBasket />;
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Items</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          {items.length} things you buy, most bought first. Open one to see every price you paid, or to tell Basket two names are the same product.
        </p>
      </header>
      <Panel flush className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-label text-muted">
            <tr className="border-b border-line">
              <th className="px-6 py-4 font-medium sm:px-8">Item</th>
              <th className="px-4 py-4 text-right font-medium">Last paid</th>
              <th className="px-4 py-4 text-right font-medium">Since first</th>
              <th className="px-4 py-4 text-right font-medium">Bought</th>
              <th className="px-6 py-4 font-medium sm:px-8">Cheapest at</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.itemKey} className="border-b border-line last:border-b-0 hover:bg-white/[0.02]">
                <td className="px-6 py-4 sm:px-8">
                  <Link href={`/basket/items/${item.itemKey}`} className="font-medium hover:text-action">
                    {item.itemName}
                  </Link>
                </td>
                <td className="px-4 py-4 text-right">{formatMoney(item.lastPaidMinor, item.currency)}</td>
                <td className={cx("px-4 py-4 text-right", item.changeRatio === null ? "text-muted" : item.changeRatio > 0 ? "text-rise" : item.changeRatio < 0 ? "text-fall" : "text-muted")}>
                  {item.changeRatio === null ? "Once" : formatPercent(item.changeRatio)}
                </td>
                <td className="px-4 py-4 text-right text-soft">{item.timesBought}×</td>
                <td className="px-6 py-4 text-soft sm:px-8">{item.cheapestStore ?? <span className="text-muted">One store so far</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
