import { expect, test, type Page } from "@playwright/test";

const dir = process.env.LIVE_IMAGES;
test.skip(!dir, "set LIVE_IMAGES to a folder of receipt photos");

const timings: Record<string, number> = {};

async function scan(page: Page, file: string) {
  const t0 = Date.now();
  await page.goto("/basket/scan");
  await page.locator('input[type="file"]').setInputFiles(`${dir}/${file}`);
  await page.waitForURL(/\/basket\/receipts\/[0-9a-f-]+\?(new|duplicate)=1/, { timeout: 180_000 });
  timings[file] = Date.now() - t0;
  await page.screenshot({ path: `${dir}/after-${file.replace(".jpg", "")}.png`, fullPage: true });
}

test("a real household's basket on Walrus mainnet", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  await expect(page.locator("code")).toHaveText(/^bsk_/);
  await page.getByRole("button", { name: "Scan your first receipt" }).click();

  await scan(page, "receipt-a.jpg");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/shoprite/i);
  await expect(page.getByText("Every price here is now remembered.")).toBeVisible();
  await expect(page.getByText(/Peak Evaporated Milk/i).first()).toBeVisible();
  await expect(page.getByText(/₦20,450/).first()).toBeVisible();

  // Another store prints the same products differently; memory must join them.
  await scan(page, "receipt-b.jpg");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/spar/i);
  await expect(page.getByText(/under usual|Usual price|over usual/).first()).toBeVisible();

  // Back at the first store: rises, a cheaper store, and a smaller pack.
  await scan(page, "receipt-c.jpg");
  await expect(page.getByText(/over usual/).first()).toBeVisible();
  await expect(page.getByText(/^Cheaper at /).first()).toBeVisible();
  await expect(page.getByText("Smaller pack", { exact: true })).toBeVisible();
  await expect(page.getByText(/Basket learned \d+ things? from this receipt/)).toBeVisible();
  await expect(page.getByText(/Committed at Sui checkpoint/)).toBeVisible();

  // The receipt's write lands on Walrus Memory mainnet.
  const t0 = Date.now();
  await expect(page.getByText(/Stored on Walrus as blob/)).toBeVisible({ timeout: 240_000 });
  timings.walrusWrite = Date.now() - t0;

  // Price check from a real photo of a shelf tag.
  await page.goto("/basket/check");
  const t1 = Date.now();
  await page.getByLabel("Photo of a price tag").setInputFiles(`${dir}/price-tag.jpg`);
  await expect(page.getByLabel("Price asked")).toHaveValue("13500", { timeout: 120_000 });
  timings.priceTag = Date.now() - t1;
  await expect(page.getByText(/^High:/)).toBeVisible();
  await page.screenshot({ path: `${dir}/after-check.png`, fullPage: true });

  await page.goto("/basket");
  await expect(page.getByText(/Your basket inflation/)).toBeVisible();
  await page.screenshot({ path: `${dir}/after-overview.png`, fullPage: true });
  await page.goto("/basket/memory");
  await expect(page.getByText("Latest checkpoint")).toBeVisible();
  await page.screenshot({ path: `${dir}/after-memory.png`, fullPage: true });

  console.log("timings (ms)", JSON.stringify(timings));
});
