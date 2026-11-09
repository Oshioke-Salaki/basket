"use client";

import Link from "next/link";
import { useBasket } from "@/components/basket/basket-provider";
import { EmptyBasket } from "@/components/basket/empty-basket";
import { Panel } from "@/components/ui/panel";
import { formatDay } from "@/domain/dates";
import { formatMoney } from "@/domain/money";

export default function ReceiptsPage() {
  const { receipts } = useBasket();
  if (receipts.length === 0) return <EmptyBasket />;
  const sorted = [...receipts].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.scannedAt.localeCompare(a.scannedAt));
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Receipts</h1>
        <p className="mt-2 text-muted">
          {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"} remembered on Walrus, newest purchase first.
        </p>
      </header>
      <Panel className="p-0 sm:p-0">
        <ul>
          {sorted.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={`/basket/receipts/${r.id}`} className="flex items-center justify-between gap-6 px-6 py-5 transition-colors hover:bg-white/[0.02] sm:px-8">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.store.name}</span>
                  <span className="block text-sm text-muted">
                    {formatDay(r.purchasedOn, { year: true })} · {r.lines.length} items
                  </span>
                </span>
                <span className="shrink-0 font-medium">{formatMoney(r.totalMinor, r.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
