"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isoDay } from "@/domain/dates";
import { formatApprox } from "@/domain/money";
import { nextShop, type DueItem } from "@/domain/next-shop";
import { formatSize } from "@/domain/units";
import { cx } from "../ui/cx";
import { Label, Panel, PanelHeader } from "../ui/panel";
import { useBasket } from "./basket-provider";

const subscribeToNothing = () => () => {};

/** Today in the viewer's own calendar, read on the client only. */
function useToday(): string | null {
  return useSyncExternalStore(subscribeToNothing, () => isoDay(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)), () => null);
}

function due(item: DueItem): string {
  if (item.dueInDays < -1) return `${-item.dueInDays} days overdue`;
  if (item.dueInDays === -1) return "a day overdue";
  if (item.dueInDays === 0) return "due today";
  if (item.dueInDays === 1) return "due tomorrow";
  return `due in ${item.dueInDays} days`;
}

/** What the household is about to run out of, and the cheapest of its own stores for each. */
export function NextShopPanel() {
  const { effective, home } = useBasket();
  const today = useToday();
  const plan = useMemo(() => (today ? nextShop(effective, today, home) : null), [effective, home, today]);
  if (!plan) return null;
  if (plan.items.length === 0) {
    if (plan.upcoming.length === 0) return null;
    return (
      <Panel aria-labelledby="next-shop-h">
        <PanelHeader title={<span id="next-shop-h">Your next shop</span>}>Nothing you buy regularly runs out this week. Coming up next, from the rhythm you buy each item at:</PanelHeader>
        <ul>
          {plan.upcoming.map((item) => (
            <li key={item.itemKey} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <span className="min-w-0">
                <span className="block truncate">{item.itemName}</span>
                <span className="block text-sm text-muted">
                  {due(item)} · cheapest lately at {item.storeName}
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatApprox(item.expectedMinor, plan.currency)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
  const money = (minor: number) => formatApprox(minor, plan.currency);

  return (
    <Panel aria-labelledby="next-shop-h">
      <PanelHeader title={<span id="next-shop-h">Your next shop</span>}>
        From the rhythm you buy each item at, here is what is running out this week and where it is cheapest among your own stores.
      </PanelHeader>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          {plan.stops.map((stop) => (
            <div key={stop.storeKey}>
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                <h3 className="font-medium">At {stop.storeName}</h3>
                <span className="text-sm text-muted">about {money(stop.subtotalMinor)}</span>
              </div>
              <ul>
                {stop.items.map((item) => (
                  <li key={item.itemKey} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate">
                        {item.itemName}
                        {item.size ? <span className="text-muted"> · {formatSize(item.size)}</span> : null}
                        {item.quantity !== 1 ? <span className="text-muted"> × {item.quantity}</span> : null}
                      </span>
                      <span className={cx("block text-sm", item.dueInDays < 0 ? "text-rise" : "text-muted")}>
                        {due(item)} · you buy it every {item.intervalDays} days
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{money(item.expectedMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-6 rounded-md bg-ground/60 p-6">
          <div>
            <Label>Estimated total</Label>
            <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">{money(plan.totalMinor)}</p>
            <p className="text-sm text-muted">
              {plan.items.length} {plan.items.length === 1 ? "item" : "items"} at {plan.stops.length} {plan.stops.length === 1 ? "store" : "stores"}
            </p>
          </div>
          {plan.savingMinor > 0 ? (
            <div>
              <Label>Against your usual prices</Label>
              <p className="mt-1 text-[1.5rem] leading-tight font-medium tracking-tight text-fall">{money(plan.savingMinor)} less</p>
              <p className="text-sm text-muted">by buying each item where you last found it cheapest</p>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
