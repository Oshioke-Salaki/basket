"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useId, useMemo, useState } from "react";
import { useBasket } from "@/components/basket/basket-provider";
import { basisLabel } from "@/components/basket/describe";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { Button, TextLink } from "@/components/ui/button";
import { Label, Panel, PanelHeader } from "@/components/ui/panel";
import { formatDay } from "@/domain/dates";
import { itemSummaries } from "@/domain/items";
import { formatMoney, formatPercent, formatUnitPrice } from "@/domain/money";
import { unitPrice } from "@/domain/observations";
import { formatSize } from "@/domain/units";
import { ApiError } from "@/lib/api";

export function ItemView() {
  return (
    <Suspense>
      <ItemContent />
    </Suspense>
  );
}

function ItemContent() {
  const { key } = useParams<{ key: string }>();
  const { effective } = useBasket();
  const items = useMemo(() => itemSummaries(effective), [effective]);
  const item = items.find((i) => i.itemKey === key);

  if (!item) {
    return (
      <div className="grid gap-3">
        <h1 className="text-title">Item not found</h1>
        <p className="text-muted">It may have been joined with another item.</p>
        <TextLink href="/basket/items">See all items</TextLink>
      </div>
    );
  }
  const label = basisLabel(item.basis);
  const points = item.observations
    .filter((o) => unitPrice(o).basis === item.basis)
    .map((o) => ({ date: o.date, value: unitPrice(o).value, storeKey: o.storeKey, storeName: o.storeName }));
  const money = (minor: number) => formatMoney(Math.round(minor), item.currency);
  const unit = (minor: number) => formatUnitPrice(minor, item.currency);

  return (
    <div className="grid gap-6">
      <header>
        <TextLink href="/basket/items" className="text-sm">
          All items
        </TextLink>
        <h1 className="mt-3 text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">{item.itemName}</h1>
      </header>

      <Panel>
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          <div>
            <Label>Usual price {label}</Label>
            <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{item.usual === null ? "Not yet" : unit(item.usual)}</p>
          </div>
          <div>
            <Label>Since you first bought it</Label>
            <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{item.changeRatio === null ? "Once" : formatPercent(item.changeRatio)}</p>
          </div>
          <div>
            <Label>Bought</Label>
            <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{item.timesBought}×</p>
          </div>
        </div>
        <PriceHistoryChart points={points} currency={item.currency} usual={item.usual} basisLabel={label} />
      </Panel>

      <Panel flush>
        <h2 className="px-6 pt-6 text-lead font-medium sm:px-8 sm:pt-8">Every purchase</h2>
        <ul className="mt-4">
          {[...item.observations].reverse().map((o) => (
            <li key={`${o.receiptId}-${o.lineIndex}`} className="flex items-center justify-between gap-4 border-t border-line px-6 py-4 sm:px-8">
              <span className="min-w-0">
                <span className="block truncate">{o.storeName}</span>
                <span className="block text-sm text-muted">
                  {formatDay(o.date, { year: true })}
                  {o.size ? ` · ${formatSize(o.size)}` : ""}
                  {o.quantity !== 1 ? ` · ${o.quantity} packs` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-medium">{money(o.packMinor)}</span>
                {o.size ? <span className="block text-sm text-muted">{unit(unitPrice(o).value)} {basisLabel(unitPrice(o).basis)}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <MergePanel itemKey={item.itemKey} itemName={item.itemName} others={items.filter((i) => i.itemKey !== item.itemKey).map((i) => ({ key: i.itemKey, name: i.itemName }))} />
    </div>
  );
}

/** The household tells Basket that two names are one product. Stored as a lesson on Walrus. */
function MergePanel({ itemKey, itemName, others }: { itemKey: string; itemName: string; others: { key: string; name: string }[] }) {
  const { merge, readOnly } = useBasket();
  const router = useRouter();
  const selectId = useId();
  const [target, setTarget] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });
  if (readOnly || others.length === 0) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) {
      setState({ kind: "error", message: "Choose the item this is the same as." });
      return;
    }
    setState({ kind: "saving" });
    try {
      await merge(itemKey, target);
      setState({ kind: "done" });
      router.push(`/basket/items/${target}`);
    } catch (error) {
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "The items could not be joined. Try again." });
    }
  }

  return (
    <Panel>
      <PanelHeader title="Same product, different name?">
        Stores print names differently. Join {itemName} to the item it really is, and their price histories become one. Basket remembers the match for every future receipt.
      </PanelHeader>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <label htmlFor={selectId} className="text-sm font-medium text-soft">
            The same product as
          </label>
          <select
            id={selectId}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-12 rounded-sm border border-line-strong bg-ground px-4 text-ink focus:border-action focus:outline-none"
          >
            <option value="">Choose an item</option>
            {others.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" className="h-12" disabled={state.kind === "saving"}>
          Join the two items
        </Button>
      </form>
      {state.kind === "error" ? <p className="mt-2 text-sm text-rise">{state.message}</p> : null}
    </Panel>
  );
}
