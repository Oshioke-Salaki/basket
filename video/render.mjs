/**
 * render.mjs: renders the film frame by frame in Chrome and muxes the score and the voice.
 *
 *   node render.mjs --stills 1.2,9.4,...   one PNG per time, for review (out/stills)
 *   node render.mjs --check                re-render sample frames out of order and compare
 *   node render.mjs                        out/basket-film.mp4 (needs out/score.wav)
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const ROOT = new URL(".", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const timeline = JSON.parse(readFileSync(join(ROOT, "timeline.json"), "utf8"));
const FPS = timeline.fps;
const FRAMES = Math.round(timeline.duration * FPS);
mkdirSync(join(ROOT, "out", "stills"), { recursive: true });

function serve() {
  const server = createServer((req, res) => {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!path.startsWith(ROOT) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function open() {
  const server = await serve();
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);
  await page.waitForFunction(() => window.filmReady || window.filmError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.filmError);
  if (err) throw new Error(err);
  const stage = page.locator("#stage");
  const frame = async (t, type = "jpeg") => {
    await page.evaluate((tt) => window.seek(tt), t);
    return stage.screenshot({ type, quality: type === "jpeg" ? 92 : undefined, animations: "disabled" });
  };
  return { frame, close: async () => { await browser.close(); server.close(); } };
}

const args = process.argv.slice(2);
const film = await open();
try {
  if (args[0] === "--stills") {
    for (const t of args[1].split(",").map(Number)) {
      const buf = await film.frame(t, "png");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(ROOT, "out", "stills", `t${t.toFixed(2).padStart(6, "0")}.png`), buf);
      console.log("still", t);
    }
  } else if (args[0] === "--check") {
    const sample = Array.from({ length: 24 }, (_, i) => Math.round(((i * 7919) % FRAMES)) / FPS);
    const first = [];
    for (const t of sample) first.push(createHash("sha1").update(await film.frame(t, "png")).digest("hex"));
    let off = 0;
    for (const [i, t] of [...sample.entries()].reverse()) {
      const h = createHash("sha1").update(await film.frame(t, "png")).digest("hex");
      if (h !== first[i]) { off++; console.log("revisited frame differs at", t.toFixed(3)); }
    }
    console.log(off ? `${off} frames differ` : "every revisited frame matches");
    process.exitCode = off ? 1 : 0;
  } else {
    const silent = join(ROOT, "out", "picture.mp4");
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent], { stdio: ["pipe", "inherit", "inherit"] });
    const t0 = Date.now();
    for (let f = 0; f < FRAMES; f++) {
      const buf = await film.frame(f / FPS + 0.5 / FPS * 0);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (f % 150 === 0) console.log(`frame ${f}/${FRAMES} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log("picture done");
  }
} finally {
  await film.close();
}
