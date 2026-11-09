import type { z } from "zod";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export interface InputImage {
  readonly bytes: Uint8Array;
  readonly mediaType: ImageType;
}

export interface VisionRequest<S extends z.ZodType> {
  /** What the model is for; stable across calls so providers can cache it. */
  readonly system: string;
  /** The per-call context: known items, the household's currency. */
  readonly text: string;
  readonly image: InputImage;
  readonly schema: S;
  readonly schemaName: string;
}

/**
 * One image in, one schema-valid object out. Basket's readers depend on this
 * port only, so the receipt and shelf-tag readers run on Claude or OpenAI alike.
 */
export interface VisionModel {
  readonly provider: "anthropic" | "openai";
  readonly model: string;
  extract<S extends z.ZodType>(request: VisionRequest<S>): Promise<z.infer<S>>;
}
