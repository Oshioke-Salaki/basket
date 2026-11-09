import { z } from "zod";
import { ReceiptSchema, slugify, type Receipt } from "./receipt";
import { SizeSchema } from "./units";

/** A household's correction to one line the reader got wrong. */
export const LineRevisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    lineIndex: z.number().int().nonnegative(),
    itemName: z.string().trim().min(1).max(120),
    /** An item the household already buys; omitted to create a new item from the name. */
    itemKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).nullable(),
    totalMinor: z.number().int().positive(),
    quantity: z.number().positive().max(1000),
    size: SizeSchema.nullable(),
  }),
  z.object({ action: z.literal("remove"), lineIndex: z.number().int().nonnegative() }),
]);
export type LineRevision = z.infer<typeof LineRevisionSchema>;

export class RevisionError extends Error {}

/**
 * Apply a correction and return the next version of the receipt. The printed
 * total is kept unless it was the sum of the lines, in which case it follows them.
 */
export function reviseReceipt(receipt: Receipt, revision: LineRevision, now: Date): Receipt {
  const line = receipt.lines[revision.lineIndex];
  if (!line) throw new RevisionError("That line is not on this receipt.");
  const lines =
    revision.action === "remove"
      ? receipt.lines.filter((_, i) => i !== revision.lineIndex)
      : receipt.lines.map((l, i) =>
          i === revision.lineIndex
            ? {
                ...l,
                itemName: revision.itemName,
                itemKey: revision.itemKey ?? (slugify(revision.itemName) || l.itemKey),
                totalMinor: revision.totalMinor,
                quantity: revision.quantity,
                size: revision.size,
              }
            : l,
        );
  if (lines.length === 0) throw new RevisionError("A receipt needs at least one item. Keep this line or scan the receipt again.");
  const oldSum = receipt.lines.reduce((s, l) => s + l.totalMinor, 0);
  const newSum = lines.reduce((s, l) => s + l.totalMinor, 0);
  return ReceiptSchema.parse({
    ...receipt,
    lines,
    totalMinor: receipt.totalMinor === oldSum ? newSum : receipt.totalMinor,
    revisedAt: now.toISOString(),
  });
}

/** The newest version of a receipt: revised beats original, later revision beats earlier. */
export function newerVersion(a: Receipt, b: Receipt): Receipt {
  return (b.revisedAt ?? b.scannedAt) > (a.revisedAt ?? a.scannedAt) ? b : a;
}
