"use client";

import { useId, useState } from "react";
import { formatDay } from "@/domain/dates";
import type { IndexPoint } from "@/domain/inflation";
import { formatPercent } from "@/domain/money";
import { dayValue, linear } from "./scale";
import { useWidth } from "./use-width";

const HEIGHT = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 8 };

/**
 * The household's own price index over time. One series, so no legend: the
 * panel title names it. 100 is where each item's tracking started.
 */
export function IndexChart({ points, label }: { points: readonly IndexPoint[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const values = points.map((p) => p.value);
  const lo = Math.min(100, ...values);
  const hi = Math.max(100, ...values);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const y = linear([lo - pad, hi + pad], [HEIGHT - PAD.bottom, PAD.top]);
  const times = points.map((p) => dayValue(p.date));
  const x = linear([times[0]!, times[times.length - 1]!], [PAD.left, width - PAD.right]);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(times[i]!).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1]!;
  const active = hover === null ? null : points[hover]!;
  const change = (v: number) => formatPercent(v / 100 - 1);

  function onMove(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(times[i]!) - px) < Math.abs(x(times[best]!) - px)) best = i;
    setHover(best);
  }

  return (
    <figure className="m-0">
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-labelledby={titleId}
          className="block touch-none"
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
        >
          <title id={titleId}>{`${label}: ${change(last.value)} from ${formatDay(points[0]!.date, { year: true })} to ${formatDay(last.date, { year: true })}`}</title>
          {y.ticks(3).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={width - PAD.right + 8} y={y(t)} dy="0.32em" className="fill-muted text-[12px]">
                {t}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(100)} y2={y(100)} stroke="var(--color-muted)" strokeDasharray="3 4" />
          <path d={path} fill="none" stroke="var(--color-action)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={p.date} cx={x(times[i]!)} cy={y(p.value)} r={hover === i ? 5 : 3.5} fill="var(--color-action)" stroke="var(--color-surface)" strokeWidth={2} />
          ))}
          <text x={PAD.left} y={HEIGHT - 6} className="fill-muted text-[12px]">
            {formatDay(points[0]!.date)}
          </text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted text-[12px]">
            {formatDay(last.date)}
          </text>
          {active ? (
            <line x1={x(dayValue(active.date))} x2={x(dayValue(active.date))} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--color-line-strong)" />
          ) : null}
        </svg>
        {active ? (
          <div
            className="pointer-events-none absolute top-2 rounded-sm border border-line bg-raised px-3 py-2 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(0, x(dayValue(active.date)) - 80), width - 176), width: 160 }}
          >
            <p className="text-muted">{formatDay(active.date, { year: true })}</p>
            <p className="font-medium">
              Index {active.value.toFixed(1)} <span className="text-muted">({change(active.value)})</span>
            </p>
          </div>
        ) : null}
      </div>
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer select-none hover:text-ink">Show as a table</summary>
        <table className="mt-3 w-full max-w-md text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-1.5 font-medium">Date</th>
              <th className="py-1.5 text-right font-medium">Index</th>
              <th className="py-1.5 text-right font-medium">Since start</th>
            </tr>
          </thead>
          <tbody className="text-soft">
            {points.map((p) => (
              <tr key={p.date} className="border-b border-line">
                <td className="py-1.5">{formatDay(p.date, { year: true })}</td>
                <td className="py-1.5 text-right">{p.value.toFixed(1)}</td>
                <td className="py-1.5 text-right">{change(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
