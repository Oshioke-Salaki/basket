export interface Linear {
  (value: number): number;
  ticks: (count: number) => number[];
}

export function linear([d0, d1]: [number, number], [r0, r1]: [number, number]): Linear {
  const span = d1 - d0 || 1;
  const fn = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Linear;
  fn.ticks = (count: number) => niceTicks(d0, d1, count);
  return fn;
}

export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export const dayValue = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
