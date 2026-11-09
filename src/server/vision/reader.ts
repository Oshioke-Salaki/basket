import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { KnownItem } from "@/domain/ledger";
import { config, required } from "../config";
import { AppError } from "../errors";
import { ExtractionSchema, type Extraction } from "./extraction";
import { fakeExtraction } from "./fake";
import { SYSTEM_PROMPT, knownItemsMessage } from "./prompt";

export const RECEIPT_MODEL = "claude-opus-5-5";
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReceiptImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export interface ReceiptImage {
  readonly bytes: Uint8Array;
  readonly mediaType: ReceiptImageType;
}

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: required("ANTHROPIC_API_KEY", "Receipt reading"), maxRetries: 2, timeout: 90_000 });
  return client;
}

/** Read a receipt photo into structured lines, steered by what the household already buys. */
export async function readReceipt(image: ReceiptImage, known: readonly KnownItem[], homeCurrency: string | null): Promise<Extraction> {
  if (config().BASKET_FAKE_SERVICES) return fakeExtraction(image.bytes);

  try {
    const response = await anthropic().beta.messages.parse({
      model: RECEIPT_MODEL,
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: Buffer.from(image.bytes).toString("base64") } },
            { type: "text", text: `${knownItemsMessage(known, homeCurrency)}\n\nRead this receipt.` },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      throw new AppError("unreadable_receipt", "This image could not be read as a receipt.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new AppError("unreadable_receipt", "The receipt was too long or unclear to read in one go. Try a sharper photo of fewer lines.");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError("rate_limited", "The receipt reader is busy. Try again in a minute.", { cause: error, retryAfterSeconds: 60 });
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AppError("unreadable_receipt", "That image could not be processed. Try a JPEG or PNG photo.", { cause: error });
    }
    throw new AppError("upstream_unavailable", "The receipt reader is unavailable right now.", { cause: error });
  }
}
