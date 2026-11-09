import "server-only";
import { z } from "zod";
import type { KnownItem } from "@/domain/ledger";
import { config } from "../config";
import { SIZE_UNITS } from "./extraction";
import { visionModel } from "./models/select";
import type { InputImage } from "./models/port";
import { knownItemsMessage } from "./prompt";

export const PriceTagSchema = z.object({
  readable: z.boolean().describe("False when no price for a product can be read."),
  problem: z.string().nullable(),
  item_key: z.string().describe("The household's known item key when this is the same product, else a new lowercase kebab-case key."),
  item_name: z.string(),
  price: z.number().describe("Price for one pack, in major units as shown."),
  size_amount: z.number().nullable(),
  size_unit: z.enum(SIZE_UNITS).nullable(),
  currency: z.string().describe("ISO 4217 code, from the symbol or the household's usual currency."),
});
export type PriceTag = z.infer<typeof PriceTagSchema>;

const SYSTEM = `You read one price for one product from a photo taken in a shop or market: a shelf label, a price sticker, a handwritten card or a menu board. Basket uses it to tell the shopper whether the price is fair against what their household has paid before.

Return the product, its pack size if shown and the price for one pack. When it is the same product as one of the household's known items, reuse that item's key and name exactly. If several prices are visible, take the most prominent one. If no price can be read, set readable to false and say why in problem.`;

export async function readPriceTag(image: InputImage, known: readonly KnownItem[], homeCurrency: string | null): Promise<PriceTag> {
  if (config().BASKET_FAKE_SERVICES) {
    return { readable: true, problem: null, item_key: "mama-gold-rice", item_name: "Mama Gold Rice", price: 13500, size_amount: 5, size_unit: "kg", currency: homeCurrency ?? "NGN" };
  }
  return visionModel().extract({ system: SYSTEM, text: `${knownItemsMessage(known, homeCurrency)}\n\nRead the price in this photo.`, image, schema: PriceTagSchema, schemaName: "price_tag" });
}
