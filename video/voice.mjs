/**
 * Generates the narration with OpenAI's speech model, one file per line, cached by text.
 * Run: node --env-file=../.env.local voice.mjs   → vo/<id>.wav and vo/durations.json
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MODEL = "gpt-4o-mini-tts-2025-12-15";
const VOICE = process.env.VO_VOICE || "marin";
const INSTRUCTIONS =
  "Narrate a short product film. Warm, assured and quietly delighted, like a friend showing you something clever. Unhurried, clear, natural rhythm with small pauses at full stops. Not salesy, not breathy. Internationally neutral English.";

const lines = JSON.parse(readFileSync("vo-lines.json", "utf8"));
const durations = {};
for (const line of lines) {
  const tag = createHash("sha1").update(`${MODEL}|${VOICE}|${INSTRUCTIONS}|${line.text}`).digest("hex").slice(0, 10);
  const file = `vo/${line.id}-${tag}.wav`;
  if (!existsSync(file)) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: line.text, instructions: INSTRUCTIONS, response_format: "wav" }),
    });
    if (!res.ok) throw new Error(`${line.id}: HTTP ${res.status} ${await res.text()}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
  durations[line.id] = { file, seconds, bar: line.bar };
  console.log(line.id, seconds.toFixed(2), "s");
}
writeFileSync("vo/durations.json", JSON.stringify(durations, null, 2));
