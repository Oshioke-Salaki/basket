import { defineConfig, devices } from "@playwright/test";

/**
 * Live end-to-end run against real services (Walrus Memory mainnet, Tatum, the
 * receipt reader) using the keys in .env.local. Costs a few cents per run.
 * Run: LIVE_IMAGES=<dir with receipt-a/b/c.jpg and price-tag.jpg> pnpm playwright test -c playwright.live.config.ts
 */
export default defineConfig({
  testDir: "./e2e-live",
  timeout: 15 * 60_000,
  expect: { timeout: 120_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3400", ...devices["Desktop Chrome"], channel: "chrome", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm next dev --port 3400",
    url: "http://localhost:3400/start",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { BASKET_FAKE_SERVICES: "0" },
  },
});
