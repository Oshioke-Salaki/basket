import "server-only";
import type { KnownItem } from "@/domain/ledger";
import { config } from "../config";
import { ExtractionSchema, type Extraction } from "./extraction";
import { fakeExtraction } from "./fake";
import { visionModel } from "./models/select";
import type { InputImage } from "./models/port";
import { SYSTEM_PROMPT, knownItemsMessage } from "./prompt";

export { ACCEPTED_IMAGE_TYPES, type ImageType as ReceiptImageType, type InputImage as ReceiptImage } from "./models/port";

/** Read a receipt photo into structured lines, steered by what the household already buys. */
export async function readReceipt(image: InputImage, known: readonly KnownItem[], homeCurrency: string | null): Promise<Extraction> {
  if (config().BASKET_FAKE_SERVICES) return fakeExtraction(image.bytes);
  return visionModel().extract({
    system: SYSTEM_PROMPT,
    text: `${knownItemsMessage(known, homeCurrency)}\n\nRead this receipt.`,
    image,
    schema: ExtractionSchema,
    schemaName: "receipt",
  });
}
