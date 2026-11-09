import type { Extraction } from "./extraction";

/**
 * Deterministic receipts for automated tests (BASKET_FAKE_SERVICES=1). A test
 * image selects one by carrying the bytes `basket-fixture:<n>`; otherwise they
 * are served in order. Never used outside test mode.
 */
type Line = Extraction["lines"][number];

const line = (raw: string, item_key: string, item_name: string, size: [number, Line["size_unit"]] | null, line_total: number, category: Line["category"], quantity = 1): Line => ({
  raw,
  item_key,
  item_name,
  size_amount: size?.[0] ?? null,
  size_unit: size?.[1] ?? null,
  quantity,
  line_total,
  category,
});

const FIXTURES: readonly Extraction[] = [
  {
    readable: true,
    problem: null,
    store_name: "Shoprite Lekki",
    purchased_on: "2026-10-03",
    currency: "NGN",
    total: 19600,
    lines: [
      line("PEAK EVAP MILK 400G", "peak-evaporated-milk", "Peak Evaporated Milk", [400, "g"], 2300, "dairy_eggs"),
      line("MAMA GOLD RICE 5KG", "mama-gold-rice", "Mama Gold Rice", [5, "kg"], 12000, "staples"),
      line("G/PENNY SPAGHETTI 500G", "golden-penny-spaghetti", "Golden Penny Spaghetti", [500, "g"], 1000, "staples"),
      line("KINGS VEG OIL 1L", "kings-vegetable-oil", "Kings Vegetable Oil", [1, "l"], 3200, "staples"),
      line("DANGOTE SUGAR 500G", "dangote-sugar", "Dangote Sugar", [500, "g"], 1100, "staples"),
    ],
  },
  {
    readable: true,
    problem: null,
    store_name: "Market Square Ajah",
    purchased_on: "2026-10-17",
    currency: "NGN",
    total: 16930,
    lines: [
      line("PEAK MILK TIN 400G", "peak-evaporated-milk", "Peak Evaporated Milk", [400, "g"], 2250, "dairy_eggs"),
      line("MAMA GOLD 5KG", "mama-gold-rice", "Mama Gold Rice", [5, "kg"], 11200, "staples"),
      line("GOLDEN PENNY SPAG 500G", "golden-penny-spaghetti", "Golden Penny Spaghetti", [500, "g"], 980, "staples"),
      line("INDOMIE CHICKEN 70G X5", "indomie-chicken-noodles", "Indomie Chicken Noodles", [70, "g"], 2500, "staples", 5),
    ],
  },
  {
    readable: true,
    problem: null,
    store_name: "Shoprite Lekki",
    purchased_on: "2026-11-07",
    currency: "NGN",
    total: 19900,
    lines: [
      line("PEAK EVAP MILK 400G", "peak-evaporated-milk", "Peak Evaporated Milk", [400, "g"], 2600, "dairy_eggs"),
      line("MAMA GOLD RICE 5KG", "mama-gold-rice", "Mama Gold Rice", [5, "kg"], 13100, "staples"),
      line("G/PENNY SPAGHETTI 450G", "golden-penny-spaghetti", "Golden Penny Spaghetti", [450, "g"], 1000, "staples"),
      line("KINGS VEG OIL 1L", "kings-vegetable-oil", "Kings Vegetable Oil", [1, "l"], 3200, "staples"),
    ],
  },
];

const UNREADABLE: Extraction = { readable: false, problem: "This looks like a photo of a cat, not a receipt.", store_name: "", purchased_on: null, currency: "NGN", total: null, lines: [] };

let sequence = 0;

export function fakeExtraction(bytes: Uint8Array): Extraction {
  const text = Buffer.from(bytes).toString("latin1");
  if (text.includes("basket-fixture:unreadable")) return UNREADABLE;
  const match = /basket-fixture:(\d)/.exec(text);
  const index = match ? Number(match[1]) : sequence++;
  return structuredClone(FIXTURES[index % FIXTURES.length]!);
}
