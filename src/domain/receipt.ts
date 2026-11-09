import { z } from "zod";
import { SizeSchema } from "./units";

export const CATEGORIES = [
  "staples",
  "produce",
  "meat_fish",
  "dairy_eggs",
  "bakery",
  "drinks",
  "snacks",
  "household",
  "personal_care",
  "baby",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  staples: "Staples",
  produce: "Fruit & veg",
  meat_fish: "Meat & fish",
  dairy_eggs: "Dairy & eggs",
  bakery: "Bakery",
  drinks: "Drinks",
  snacks: "Snacks",
  household: "Household",
  personal_care: "Personal care",
  baby: "Baby",
  other: "Other",
};

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase kebab-case key");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const ReceiptLineSchema = z.object({
  /** The line as printed, kept so the household can audit what was read. */
  raw: z.string().max(200),
  /** Product identity without pack size, stable across receipts and stores. */
  itemKey: slug,
  itemName: z.string().min(1).max(120),
  size: SizeSchema.nullable(),
  quantity: z.number().positive(),
  /** Amount paid for the whole line, in minor units. */
  totalMinor: z.number().int().nonnegative(),
  category: z.enum(CATEGORIES),
});
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

export const StoreSchema = z.object({
  key: slug,
  name: z.string().min(1).max(120),
});
export type Store = z.infer<typeof StoreSchema>;

export const ReceiptSchema = z.object({
  id: z.string().min(8).max(64),
  store: StoreSchema,
  purchasedOn: isoDate,
  currency: z.string().regex(/^[A-Z]{3}$/),
  lines: z.array(ReceiptLineSchema).min(1).max(150),
  totalMinor: z.number().int().nonnegative(),
  /** USD value of one major unit of `currency` on the day the receipt was read. */
  usdPerUnit: z.number().positive().nullable(),
  /** The day `usdPerUnit` was observed. A backfilled receipt's rate is from the day it was scanned, not bought. */
  usdRateOn: isoDate.nullable().optional(),
  /** Sui checkpoint observed through Tatum when the receipt was committed. */
  checkpoint: z.string().regex(/^\d+$/).nullable(),
  scannedAt: z.string().datetime(),
  /** Set on a version the household corrected; the newest version of a receipt wins. */
  revisedAt: z.string().datetime().nullable().optional(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/** Price paid for one pack on a line. */
export function packPriceMinor(line: ReceiptLine): number {
  return Math.round(line.totalMinor / line.quantity);
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
