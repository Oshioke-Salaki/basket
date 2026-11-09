import { slugify, type Category, type Receipt } from "../receipt";
import { normalizeSize } from "../units";

interface LineSpec {
  item: string;
  size?: [number, string];
  qty?: number;
  /** Major units paid for the whole line. */
  paid: number;
  category?: Category;
}

let counter = 0;

export function receipt(store: string, purchasedOn: string, lines: LineSpec[], opts: { currency?: string; usdPerUnit?: number | null } = {}): Receipt {
  counter += 1;
  const built = lines.map((l) => ({
    raw: l.item.toUpperCase(),
    itemKey: slugify(l.item),
    itemName: l.item,
    size: l.size ? normalizeSize(l.size[0], l.size[1]) : null,
    quantity: l.qty ?? 1,
    totalMinor: Math.round(l.paid * 100),
    category: l.category ?? "staples",
  }));
  return {
    id: `rcpt-${String(counter).padStart(6, "0")}`,
    store: { key: slugify(store), name: store },
    purchasedOn,
    currency: opts.currency ?? "NGN",
    lines: built,
    totalMinor: built.reduce((s, l) => s + l.totalMinor, 0),
    usdPerUnit: opts.usdPerUnit === undefined ? 0.00065 : opts.usdPerUnit,
    checkpoint: null,
    scannedAt: `${purchasedOn}T12:00:00.000Z`,
  };
}
