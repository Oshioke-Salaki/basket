const DAY_MS = 86_400_000;

/** Whole days from one ISO date to another; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDay(iso: string, { year = false }: { year?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}
