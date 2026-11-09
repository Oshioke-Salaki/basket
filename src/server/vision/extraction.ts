import { z } from "zod";
import { CATEGORIES } from "@/domain/receipt";

export const SIZE_UNITS = ["g", "kg", "mg", "ml", "cl", "l", "pcs"] as const;

/**
 * What the model returns. Amounts are in major units exactly as printed; the
 * server converts and validates them. Kept to the JSON Schema subset that
 * structured outputs accepts: no patterns or numeric bounds here.
 */
export const ExtractionSchema = z.object({
  readable: z.boolean().describe("False when the image is not a purchase receipt or too unclear to read prices from."),
  problem: z.string().nullable().describe("When readable is false, one short sentence the shopper can act on."),
  store_name: z.string().describe("Store or market name as printed, with the branch if shown."),
  purchased_on: z.string().nullable().describe("Purchase date as YYYY-MM-DD, or null if not printed."),
  currency: z.string().describe("ISO 4217 code of the amounts, e.g. NGN, USD, GBP, KES."),
  total: z.number().nullable().describe("Grand total paid, in major units, or null if not printed."),
  lines: z.array(
    z.object({
      raw: z.string().describe("The item line as printed."),
      item_key: z.string().describe("Lowercase kebab-case product identity without pack size. Reuse a known key when the line is the same product."),
      item_name: z.string().describe("Clean product name with brand, without pack size, e.g. 'Peak Evaporated Milk'."),
      size_amount: z.number().nullable().describe("Pack size number, e.g. 400 for 400g, or null if no size is printed or implied."),
      size_unit: z.enum(SIZE_UNITS).nullable(),
      quantity: z.number().describe("Packs bought on this line; 1 unless the receipt shows more. Weighed goods: 1."),
      line_total: z.number().describe("Amount paid for the whole line after any line discount, in major units."),
      category: z.enum(CATEGORIES),
    }),
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
