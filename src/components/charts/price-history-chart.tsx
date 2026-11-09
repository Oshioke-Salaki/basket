"use client";

import { useId, useState } from "react";
import { formatDay } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { dayValue, linear } from "./scale";
import { useWidth } from "./use-width";

export interface PricePoint {
  readonly date: string;
  readonly value: number;
  readonly storeKey: string;
  readonly storeName: string;
}

/** Validated all-pairs on the card surface: three store colours, the rest fold to grey. */
const SLOTS = ["var(--color-store-1)", "var(--color-store-2)", "var(--color-store-3)"] as const;
const OTHER = "var(--color-muted)";
const HEIGHT = 240;
const PAD = { top: 16, right: 88, bottom: 28, left: 8 };

/** Every price paid for one item, one dot per purchase, coloured by store. */
export function PriceHistoryChart({ points, currency, usual, basisLabel }: { points: readonly PricePoint[]; currency: string; usual: number | null; basisLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  // Colour follows the store, in order of first purchase, so it never changes as data grows.
  const stores: { key: string; name: string; colour: string }[] = [];
  for (const p of points) {
    if (stores.some((s) => s.key === p.storeKey)) continue;
    stores.push({ key: p.storeKey, name: p.storeName, colour: SLOTS[stores.length] ?? OTHER });
  }
  const colourOf = (key: string) => stores.find((s) => s.key === key)?.colour ?? OTHER;
  const legend = stores.length > SLOTS.length ? [...stores.slice(0, SLOTS.length), { key: "_other", name: "Other stores", colour: OTHER }] : stores;

  const values = points.map((p) => p.value).concat(usual ?? []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.2, hi * 0.04);
  const y = linear([Math.max(0, lo - pad), hi + pad], [HEIGHT - PAD.bottom, PAD.top]);
  const times = points.map((p) => dayValue(p.date));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = linear(t0 === t1 ? [t0 - 7 * 864e5, t1 + 7 * 864e5] : [t0, t1], [PAD.left + 8, width - PAD.right - 8]);
  const money = (v: number) => formatMoney(Math.round(v), currency);
  const active = hover === null ? null : points[hover]!;

  return (
    <figure className="m-0">
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-soft" aria-label="Stores">
        {legend.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.colour }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
        {usual !== null ? (
          <li className="flex items-center gap-2">
            <span className="h-0 w-4 border-t border-dashed border-muted" aria-hidden="true" />
            Usual price
          </li>
        ) : null}
      </ul>
      <div ref={ref} className="relative">
        <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block" onPointerLeave={() => setHover(null)}>
          <title id={titleId}>{`Prices paid ${basisLabel}, ${points.length} purchases`}</title>
          {y.ticks(3).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={width - PAD.right + 8} y={y(t)} dy="0.32em" className="fill-muted text-[12px]">
                {money(t)}
              </text>
            </g>
          ))}
          {usual !== null ? <line x1={PAD.left} x2={width - PAD.right} y1={y(usual)} y2={y(usual)} stroke="var(--color-muted)" strokeDasharray="3 4" /> : null}
          {points.map((p, i) => (
            <g key={`${p.date}-${p.storeKey}-${i}`}>
              <circle cx={x(times[i]!)} cy={y(p.value)} r={hover === i ? 7 : 5.5} fill={colourOf(p.storeKey)} stroke="var(--color-surface)" strokeWidth={2} />
              <circle
                cx={x(times[i]!)}
                cy={y(p.value)}
                r={16}
                fill="transparent"
                tabIndex={0}
                aria-label={`${formatDay(p.date, { year: true })}, ${p.storeName}: ${money(p.value)} ${basisLabel}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none"
              />
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6} className="fill-muted text-[12px]">
            {formatDay(points[0]!.date)}
          </text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted text-[12px]">
            {formatDay(points[points.length - 1]!.date)}
          </text>
        </svg>
        {active ? (
          <div
            className="pointer-events-none absolute rounded-sm border border-line bg-raised px-3 py-2 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(0, x(dayValue(active.date)) - 90), width - 196), top: Math.max(0, y(active.value) - 76), width: 180 }}
          >
            <p className="text-muted">
              {formatDay(active.date, { year: true })} · {active.storeName}
            </p>
            <p className="font-medium">
              {money(active.value)} <span className="text-muted">{basisLabel}</span>
            </p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
