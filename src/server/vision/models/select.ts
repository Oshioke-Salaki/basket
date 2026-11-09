import "server-only";
import { config } from "../../config";
import { AppError } from "../../errors";
import { anthropicVision } from "./anthropic";
import { openaiVision } from "./openai";
import type { VisionModel } from "./port";

let instance: VisionModel | null = null;

/**
 * The vision model this server runs: RECEIPT_READER when it is set, otherwise
 * whichever provider has a key, OpenAI first.
 */
export function visionModel(): VisionModel {
  if (instance) return instance;
  const cfg = config();
  const choice = cfg.RECEIPT_READER ?? (cfg.OPENAI_API_KEY ? "openai" : cfg.ANTHROPIC_API_KEY ? "anthropic" : null);
  if (choice === "openai") {
    if (!cfg.OPENAI_API_KEY) throw new AppError("not_configured", "RECEIPT_READER is openai but OPENAI_API_KEY is missing.");
    instance = openaiVision(cfg.OPENAI_API_KEY, cfg.OPENAI_MODEL);
  } else if (choice === "anthropic") {
    if (!cfg.ANTHROPIC_API_KEY) throw new AppError("not_configured", "RECEIPT_READER is anthropic but ANTHROPIC_API_KEY is missing.");
    instance = anthropicVision(cfg.ANTHROPIC_API_KEY);
  } else {
    throw new AppError("not_configured", "Receipt reading is not configured on this server: set OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }
  return instance;
}
