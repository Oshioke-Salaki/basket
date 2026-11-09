/**
 * Captures Basket's real screens from the production demo household at 2x, whole pages tall,
 * for the film's camera moves. Run: node capture.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("@playwright/test");

const BASE = "https://basket-iota-five.vercel.app";
const numbers = JSON.parse(readFileSync("numbers.json", "utf8"));
const HIDE = `header + div.fixed, [aria-label="Basket home"] ~ * .demo-banner { } div.fixed.inset-x-0.bg-inverse { display: none !important; } main#main { padding-top: 104px !important; } nextjs-portal { display:none !important }`;

const browser = await chromium.launch({ channel: "chrome" });

async function context(opts) {
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo`);
  await page.waitForURL(/\/basket$/);
  await page.getByText(/Your basket inflation/).waitFor({ timeout: 60000 });
  return page;
}

async function full(page, file, width) {
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(600);
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `assets/${file}`, fullPage: false });
  console.log(file, width, "x", height);
}

const desk = await context({ viewport: { width: 1440, height: 900 } });
await full(desk, "overview.png", 1440);
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.goto(`${BASE}/basket/receipts/${numbers.lastReceipt.id}`);
await desk.getByText(/over usual/).first().waitFor({ timeout: 60000 });
await full(desk, "receipt-memory.png", 1440);
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.getByRole("radio", { name: "Without memory" }).click();
await desk.getByText("Without memory, every item is new.").waitFor();
await full(desk, "receipt-blank.png", 1440);
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.goto(`${BASE}/basket/memory`);
await desk.getByText("Latest checkpoint").waitFor({ timeout: 60000 });
await full(desk, "memory.png", 1440);
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.goto(`${BASE}/basket/check`);
await desk.getByLabel("Item").fill("mama");
await desk.getByRole("button", { name: /Mama Gold Rice/ }).click();
await desk.getByLabel("Price asked").fill("13500");
await desk.getByText(/^High:/).waitFor();
await full(desk, "check.png", 1440);

const phone = await context({ ...devices["Pixel 7"] });
await phone.goto(`${BASE}/basket/check`);
await phone.getByLabel("Item").fill("mama");
await phone.getByRole("button", { name: /Mama Gold Rice/ }).click();
await phone.getByLabel("Price asked").fill("13500");
await phone.getByText(/^High:/).waitFor();
await phone.addStyleTag({ content: HIDE + " nav.fixed.bottom-0 { display:none !important }" });
await full(phone, "phone-check.png", 412);
const verdict = await phone.getByText(/^High:/).textContent();
const offer = await phone.locator("text=A fair offer").locator("xpath=following-sibling::p[1]").textContent();
console.log("verdict:", verdict, "| offer:", offer);
await browser.close();
