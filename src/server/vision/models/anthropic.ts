import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AppError } from "../../errors";
import type { VisionModel, VisionRequest } from "./port";

export const ANTHROPIC_MODEL = "claude-opus-5-5";

export function anthropicVision(apiKey: string): VisionModel {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
  return {
    provider: "anthropic",
    model: ANTHROPIC_MODEL,
    async extract<S extends z.ZodType>({ system, text, image, schema }: VisionRequest<S>) {
      try {
        const response = await client.beta.messages.parse({
          model: ANTHROPIC_MODEL,
          max_tokens: 16_000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: Buffer.from(image.bytes).toString("base64") } },
                { type: "text", text },
              ],
            },
          ],
        });
        if (response.stop_reason === "refusal") throw new AppError("unreadable_receipt", "This image could not be read.");
        if (response.stop_reason === "max_tokens" || !response.parsed_output) {
          throw new AppError("unreadable_receipt", "The photo was too long or unclear to read in one go. Try a sharper photo with fewer lines.");
        }
        return response.parsed_output as z.infer<S>;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof Anthropic.RateLimitError) throw new AppError("rate_limited", "The reader is busy. Try again in a minute.", { cause: error, retryAfterSeconds: 60 });
        if (error instanceof Anthropic.BadRequestError) throw new AppError("unreadable_receipt", "That image could not be processed. Try a JPEG or PNG photo.", { cause: error });
        throw new AppError("upstream_unavailable", "The reader is unavailable right now.", { cause: error });
      }
    },
  };
}
