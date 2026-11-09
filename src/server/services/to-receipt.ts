import { isoDay } from "@/domain/dates";
import { isCurrencyCode, toMinor } from "@/domain/money";
import { slugify, type Receipt, type ReceiptLine } from "@/domain/receipt";
import { normalizeSize } from "@/domain/units";
import { AppError } from "../errors";
import type { Extraction } from "../vision/extraction";

export interface ReceiptContext {
  readonly id: string;
  readonly now: Date;
  readonly homeCurrency: string | null;
  readonly usdPerUnit: number | null;
  readonly checkpoint: string | null;
}

/** The oldest receipt Basket accepts; older paper is too faded to trust for trends. */
const OLDEST_DAYS = 400;

/**
 * Turn what the model read into a receipt the domain can trust: amounts in minor
 * units, keys in canonical form, dates that cannot be in the future, and no
 * zero-priced or nonsensical lines.
 */
export function toReceipt(extraction: Extraction, ctx: ReceiptContext): Receipt {
  if (!extraction.readable) {
    throw new AppError("unreadable_receipt", extraction.problem?.trim() || "That photo could not be read as a receipt.");
  }
  const currency = pickCurrency(extraction.currency, ctx.homeCurrency);
  const lines = extraction.lines.map((l) => toLine(l, currency)).filter((l): l is ReceiptLine => l !== null);
  if (lines.length === 0) {
    throw new AppError("unreadable_receipt", "No priced items could be read from that receipt. Try a flatter, sharper photo.");
  }
  const lineSum = lines.reduce((sum, l) => sum + l.totalMinor, 0);
  const printed = extraction.total !== null && extraction.total > 0 ? toMinor(extraction.total, currency) : null;
  const storeName = extraction.store_name.trim().slice(0, 120) || "Unnamed store";

  return {
    id: ctx.id,
    store: { key: slugify(storeName) || "store", name: storeName },
    purchasedOn: pickDate(extraction.purchased_on, ctx.now),
    currency,
    lines,
    // A printed total wins when it is close to the lines, since it includes rounding and fees.
    totalMinor: printed !== null && Math.abs(printed - lineSum) <= lineSum * 0.25 ? printed : lineSum,
    usdPerUnit: currency === "USD" ? 1 : ctx.usdPerUnit,
    usdRateOn: currency === "USD" || ctx.usdPerUnit ? isoDay(ctx.now) : null,
    checkpoint: ctx.checkpoint,
    scannedAt: ctx.now.toISOString(),
  };
}

function toLine(l: Extraction["lines"][number], currency: string): ReceiptLine | null {
  const totalMinor = toMinor(l.line_total, currency);
  const quantity = Number.isFinite(l.quantity) && l.quantity > 0 ? Math.min(l.quantity, 1000) : 1;
  const name = l.item_name.trim().slice(0, 120);
  const key = slugify(l.item_key) || slugify(name);
  if (!(totalMinor > 0) || !name || !key) return null;
  return {
    raw: l.raw.trim().slice(0, 200),
    itemKey: key,
    itemName: name,
    size: l.size_amount !== null && l.size_unit ? normalizeSize(l.size_amount, l.size_unit) : null,
    quantity,
    totalMinor,
    category: l.category,
  };
}

function pickCurrency(read: string, home: string | null): string {
  const code = read.trim().toUpperCase();
  if (isCurrencyCode(code)) return code;
  if (home) return home;
  throw new AppError("unreadable_receipt", "The receipt's currency could not be told. Retake the photo with the totals in view.");
}

function pickDate(read: string | null, now: Date): string {
  const today = isoDay(now);
  if (!read || !/^\d{4}-\d{2}-\d{2}$/.test(read) || Number.isNaN(Date.parse(read))) return today;
  if (read > today) return today;
  const oldest = isoDay(new Date(now.getTime() - OLDEST_DAYS * 86_400_000));
  return read < oldest ? today : read;
}
