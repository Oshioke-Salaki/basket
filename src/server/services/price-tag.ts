import "server-only";
import { homeCurrency, knownItems } from "@/domain/ledger";
import { isCurrencyCode, toMinor } from "@/domain/money";
import { normalizeSize } from "@/domain/units";
import type { PriceTagPayload } from "@/lib/api-types";
import { AppError } from "../errors";
import type { Household } from "../session";
import type { InputImage } from "../vision/models/port";
import { readPriceTag } from "../vision/price-tag";
import { loadLedger } from "./basket";
import type { Pending } from "@/domain/pending";

/** Read a shelf price and match it to an item the household already buys. Nothing is written. */
export async function priceFromPhoto(household: Household, image: InputImage, pending?: Pending): Promise<PriceTagPayload> {
  const ledger = await loadLedger(household, { pending });
  const known = knownItems(ledger);
  const home = homeCurrency(ledger);
  const tag = await readPriceTag(image, known, home);
  if (!tag.readable || !(tag.price > 0)) throw new AppError("unreadable_receipt", tag.problem?.trim() || "No price could be read in that photo.");
  const code = tag.currency.trim().toUpperCase();
  const currency = isCurrencyCode(code) ? code : (home ?? "USD");
  const match = known.find((k) => k.itemKey === tag.item_key);
  return {
    itemKey: match?.itemKey ?? null,
    itemName: match?.itemName ?? tag.item_name.trim(),
    quotedMinor: toMinor(tag.price, currency),
    currency,
    size: tag.size_amount !== null && tag.size_unit ? normalizeSize(tag.size_amount, tag.size_unit) : null,
  };
}
