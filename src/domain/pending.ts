import { z } from "zod";
import { LessonSchema } from "./lessons";
import { ReceiptSchema } from "./receipt";

/**
 * Records this browser wrote that Walrus Memory may not have indexed yet. A new
 * memory takes about half a minute to become searchable, and serverless requests
 * do not share a cache, so the browser carries its own recent writes until recall
 * returns them. They are the household's own records for its own namespace.
 */
export const PendingSchema = z.object({
  receipts: z.array(ReceiptSchema).max(40),
  lessons: z.array(LessonSchema).max(300),
});
export type Pending = z.infer<typeof PendingSchema>;

export const NO_PENDING: Pending = { receipts: [], lessons: [] };

export function parsePending(value: unknown): Pending {
  if (value === undefined || value === null || value === "") return NO_PENDING;
  const raw = typeof value === "string" ? safeJson(value) : value;
  const parsed = PendingSchema.safeParse(raw);
  return parsed.success ? parsed.data : NO_PENDING;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
