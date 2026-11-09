import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { AppError } from "../../errors";
import type { VisionModel, VisionRequest } from "./port";

export const OPENAI_DEFAULT_MODEL = "gpt-5.5";

export function openaiVision(apiKey: string, model = OPENAI_DEFAULT_MODEL): VisionModel {
  const client = new OpenAI({ apiKey, maxRetries: 2, timeout: 90_000 });
  return {
    provider: "openai",
    model,
    async extract<S extends z.ZodType>({ system, text, image, schema, schemaName }: VisionRequest<S>) {
      try {
        const response = await client.responses.parse({
          model,
          instructions: system,
          input: [
            {
              role: "user",
              content: [
                { type: "input_image", detail: "high", image_url: `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}` },
                { type: "input_text", text },
              ],
            },
          ],
          text: { format: zodTextFormat(schema, schemaName) },
        });
        if (response.incomplete_details || !response.output_parsed) {
          throw new AppError("unreadable_receipt", "The photo was too long or unclear to read in one go. Try a sharper photo with fewer lines.");
        }
        return response.output_parsed as z.infer<S>;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof OpenAI.RateLimitError) throw new AppError("rate_limited", "The reader is busy. Try again in a minute.", { cause: error, retryAfterSeconds: 60 });
        if (error instanceof OpenAI.BadRequestError) throw new AppError("unreadable_receipt", "That image could not be processed. Try a JPEG or PNG photo.", { cause: error });
        throw new AppError("upstream_unavailable", "The reader is unavailable right now.", { cause: error });
      }
    },
  };
}
