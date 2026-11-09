import { z } from "zod";

/**
 * What a shared inflation card shows. It carries only these numbers, chosen by
 * the household when it shares: never a receipt, an item list or the basket key.
 */
export const ShareCardSchema = z.object({
  /** Change in the household's basket, as a ratio: 0.087 = +8.7%. */
  r: z.number().min(-0.99).max(50),
  /** The same basket in US dollars, when it differs. */
  u: z.number().min(-0.99).max(50).nullable(),
  c: z.string().regex(/^[A-Z]{3}$/),
  s: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  n: z.number().int().min(1).max(10_000),
});
export type ShareCard = z.infer<typeof ShareCardSchema>;

export function encodeShareCard(card: ShareCard): string {
  const json = JSON.stringify({ ...card, r: round(card.r), u: card.u === null ? null : round(card.u) });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeShareCard(token: string): ShareCard | null {
  if (!/^[A-Za-z0-9_-]{8,400}$/.test(token)) return null;
  try {
    const parsed = ShareCardSchema.safeParse(JSON.parse(new TextDecoder().decode(fromBase64Url(token))));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function round(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): Uint8Array {
  const s = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
}
