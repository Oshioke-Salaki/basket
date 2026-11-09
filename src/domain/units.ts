import { z } from "zod";

/**
 * Pack sizes are normalised to one of three base measures so that a 1 kg bag and
 * a 500 g bag of the same rice compare on price per gram.
 */
export const BASE_UNITS = ["g", "ml", "unit"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const SizeSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(BASE_UNITS),
});
export type Size = z.infer<typeof SizeSchema>;

const FACTORS: Record<string, { unit: BaseUnit; factor: number }> = {
  g: { unit: "g", factor: 1 },
  gram: { unit: "g", factor: 1 },
  grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  mg: { unit: "g", factor: 0.001 },
  lb: { unit: "g", factor: 453.592 },
  oz: { unit: "g", factor: 28.3495 },
  ml: { unit: "ml", factor: 1 },
  cl: { unit: "ml", factor: 10 },
  l: { unit: "ml", factor: 1000 },
  ltr: { unit: "ml", factor: 1000 },
  litre: { unit: "ml", factor: 1000 },
  liter: { unit: "ml", factor: 1000 },
  unit: { unit: "unit", factor: 1 },
  pc: { unit: "unit", factor: 1 },
  pcs: { unit: "unit", factor: 1 },
  pack: { unit: "unit", factor: 1 },
};

/** Normalise an amount in any supported unit to its base measure. */
export function normalizeSize(amount: number, unit: string): Size | null {
  const entry = FACTORS[unit.trim().toLowerCase()];
  if (!entry || !(amount > 0)) return null;
  return { amount: round(amount * entry.factor, 3), unit: entry.unit };
}

/** The measure prices are quoted per: 100 g, 100 ml or one unit. */
export function quoteBasis(unit: BaseUnit): number {
  return unit === "unit" ? 1 : 100;
}

export function formatSize(size: Size): string {
  if (size.unit === "unit") return size.amount === 1 ? "1 pc" : `${size.amount} pcs`;
  if (size.amount >= 1000) {
    const big = size.unit === "g" ? "kg" : "l";
    return `${round(size.amount / 1000, 2)}${big}`;
  }
  return `${round(size.amount, 1)}${size.unit}`;
}

export function formatBasis(unit: BaseUnit): string {
  return unit === "unit" ? "each" : `per 100${unit}`;
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
