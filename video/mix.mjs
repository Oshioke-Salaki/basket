/**
 * mix.mjs: the final film. Places each narration line at its bar, ducks the score under the
 * voice, brings the whole mix to -14 LUFS (two-pass loudnorm) and muxes it with the picture.
 * Run after `python3 score.py` and `node render.mjs`: node mix.mjs → out/basket-film.mp4
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const T = JSON.parse(readFileSync("timeline.json", "utf8"));
const VOICE_GAIN_DB = 5;

const inputs = ["-i", "out/picture.mp4", "-i", "out/score.wav"];
const parts = [];
T.vo.forEach((line, i) => {
  inputs.push("-i", line.file);
  const ms = Math.round(line.t * 1000);
  // Clear speech over a busy bed: trim the lows, lift presence, even out the level.
  parts.push(`[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,equalizer=f=3200:t=q:w=1.1:g=3,acompressor=threshold=0.1:ratio=3:attack=8:release=120:makeup=1.6,adelay=${ms}|${ms},volume=${VOICE_GAIN_DB}dB[v${i}]`);
});
const voices = T.vo.map((_, i) => `[v${i}]`).join("");
const graph = (tail) =>
  [
    ...parts,
    `${voices}amix=inputs=${T.vo.length}:normalize=0,apad=whole_dur=${T.duration}[voice]`,
    `[voice]asplit=2[vkey][vmix]`,
    `[1:a][vkey]sidechaincompress=threshold=0.012:ratio=9:attack=20:release=480:makeup=1[bed]`,
    `[bed][vmix]amix=inputs=2:normalize=0,atrim=0:${T.duration}${tail}`,
  ].join(";");

// Pass 1: measure (loudnorm prints its JSON on stderr).
const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner ${inputs.map((x) => `'${x}'`).join(" ")} -filter_complex '${graph(",loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json")}' -f null - 2>&1`]).toString();
const stats = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));

// Pass 2: apply with the measured values, linear where possible.
const ln = `,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true,aresample=48000[mix]`;
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", graph(ln), "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", "out/basket-film.mp4"], { stdio: "inherit" });

const check = execFileSync("sh", ["-c", "ffmpeg -hide_banner -i out/basket-film.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E '^ +(I:|Peak:)'"]).toString();
console.log("out/basket-film.mp4\n" + check);
