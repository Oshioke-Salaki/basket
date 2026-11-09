import { formatDay } from "@/domain/dates";
import { LessonSchema, type Lesson } from "@/domain/lessons";
import { formatMoney } from "@/domain/money";
import { ReceiptSchema, type Receipt } from "@/domain/receipt";
import { formatSize } from "@/domain/units";

/**
 * Each memory is a plain-language note for whoever opens the household's
 * Walrus Memory, followed by one tagged line Basket reads back exactly. The
 * prose also gives the relayer's embeddings something meaningful to index.
 */
export const RECEIPT_TAG = "basket:receipt:v1 ";
export const LESSON_TAG = "basket:lesson:v1 ";

export function encodeReceipt(receipt: Receipt): string {
  const money = (minor: number) => formatMoney(minor, receipt.currency);
  const lines = receipt.lines.map((l) => {
    const size = l.size ? ` ${formatSize(l.size)}` : "";
    const qty = l.quantity === 1 ? "" : ` × ${l.quantity}`;
    return `- ${l.itemName}${size}${qty}: ${money(l.totalMinor)}`;
  });
  const header = `Grocery receipt from ${receipt.store.name} on ${formatDay(receipt.purchasedOn, { year: true })}, ${money(receipt.totalMinor)} in total.`;
  return [header, ...lines, "", RECEIPT_TAG + JSON.stringify(receipt)].join("\n");
}

export function encodeLesson(lesson: Lesson): string {
  return [`Basket learned: ${lesson.text}`, "", LESSON_TAG + JSON.stringify(lesson)].join("\n");
}

export function decodeReceipt(text: string): Receipt | null {
  return decodeTagged(text, RECEIPT_TAG, (v) => ReceiptSchema.safeParse(v));
}

export function decodeLesson(text: string): Lesson | null {
  return decodeTagged(text, LESSON_TAG, (v) => LessonSchema.safeParse(v));
}

function decodeTagged<T>(text: string, tag: string, parse: (v: unknown) => { success: true; data: T } | { success: false }): T | null {
  const line = text.split("\n").find((l) => l.startsWith(tag));
  if (!line) return null;
  try {
    const parsed = parse(JSON.parse(line.slice(tag.length)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
