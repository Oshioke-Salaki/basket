import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run the real app against in-process fakes for Walrus, Tatum
 * and Claude (BASKET_FAKE_SERVICES=1), so they are deterministic and cost nothing.
 * The server is started and stopped by Playwright.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `pnpm next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/start`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { BASKET_FAKE_SERVICES: "1", BASKET_DEMO_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
