import { test } from "@playwright/test";
import { fixtureImage } from "./receipt-images";

/** Screens for visual review. Run with SCREENS_DIR=<dir> pnpm playwright test screens. */
const dir = process.env.SCREENS_DIR;
test.skip(!dir, "set SCREENS_DIR to capture review screenshots");

test("capture the app's screens", async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${info.project.name}-${name}.png`, fullPage: true });
  };
  await page.goto("/start");
  await shot("start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  await shot("key");
  await page.getByRole("button", { name: "Scan your first receipt" }).click();
  await shot("scan");
  for (const m of ["0", "1", "2"]) {
    await page.goto("/basket/scan");
    await page.locator('input[type="file"]').setInputFiles(fixtureImage(m));
    await page.waitForURL(/\/basket\/receipts\//);
  }
  await page.getByText(/Stored on Walrus as blob/).waitFor({ timeout: 20_000 });
  await shot("receipt");
  await page.goto("/basket");
  await page.getByText(/Your basket inflation/).waitFor();
  await shot("overview");
  await page.goto("/basket/items/mama-gold-rice");
  await page.getByText("Every purchase").waitFor();
  await shot("item");
  await page.goto("/basket/memory");
  await page.getByText("Latest checkpoint").waitFor();
  await shot("memory");
});
