import { expect, test, type Page } from "@playwright/test";
import { fixtureImage } from "./receipt-images";

async function scan(page: Page, marker: string) {
  await page.goto("/basket/scan");
  await page.locator('input[type="file"]').setInputFiles(fixtureImage(marker));
  await page.waitForURL(/\/basket\/receipts\/[0-9a-f-]+\?(new|duplicate)=1/);
}

async function newBasketWithHistory(page: Page) {
  // Fix the browser's clock so buying rhythms come due on a known day.
  await page.clock.setFixedTime(new Date("2026-11-20T10:00:00Z"));
  await page.goto("/start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  await page.getByRole("button", { name: "Scan your first receipt" }).click();
  for (const m of ["0", "1", "2"]) await scan(page, m);
}

test("the next shop, a price check and a corrected line", async ({ page }) => {
  await newBasketWithHistory(page);

  // Next shop: milk and rice are bought every 17 days and come due this week.
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your next shop" })).toBeVisible();
  await expect(page.getByText(/At Market Square Ajah/)).toBeVisible();
  await expect(page.getByText("Estimated total")).toBeVisible();

  // Price check by hand: rice at ₦13,500 is high, with a fair offer.
  await page.goto("/basket/check");
  await page.getByLabel("Item").fill("mama");
  await page.getByRole("button", { name: /Mama Gold Rice/ }).click();
  await page.getByLabel("Price asked").fill("13500");
  await expect(page.getByText(/^High: \d+% over what you usually pay$/)).toBeVisible();
  await expect(page.getByText("A fair offer")).toBeVisible();
  await page.getByLabel("Price asked").fill("10000");
  await expect(page.getByText(/^Good price/)).toBeVisible();

  // Price check from a photo of the tag fills the form.
  await page.getByLabel("Photo of a price tag").setInputFiles(fixtureImage("tag"));
  await expect(page.getByLabel("Price asked")).toHaveValue("13500");
  await expect(page.getByText(/^High:/)).toBeVisible();

  // Correct a misread line and see it saved as a new version.
  await page.goto("/basket/receipts");
  await page.getByRole("link", { name: /Market Square Ajah/ }).click();
  await page.getByRole("button", { name: "Correct Indomie Chicken Noodles" }).click();
  await page.getByLabel(/Paid for the line/).fill("3000");
  await page.getByRole("button", { name: "Save the correction" }).click();
  await expect(page.getByText(/^Corrected /)).toBeVisible();
  await expect(page.getByText("₦3,000", { exact: true })).toBeVisible();
});

test("a trip abroad, a new home currency, the QR code and a shared card", async ({ page }) => {
  await newBasketWithHistory(page);

  // A London receipt in pounds is converted home and priced against home.
  await scan(page, "3");
  await expect(page.getByRole("heading", { name: "Tesco Brixton" })).toBeVisible();
  await expect(page.getByText(/£3\.80 ≈ ₦/)).toBeVisible();
  await expect(page.getByText("Against your prices at home in NGN")).toBeVisible();
  await expect(page.getByText(/× home/)).toBeVisible();

  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Trips abroad" })).toBeVisible();
  await expect(page.getByText(/£3\.80/).first()).toBeVisible();

  // Switch the home currency; it is saved and everything recounts.
  await page.goto("/basket/memory");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Save the currency" }).click();
  await expect(page.getByText(/Saved to Walrus Memory/)).toBeVisible();
  await page.goto("/basket");
  await expect(page.getByText(/Counted in USD/)).toBeVisible();

  // The household QR code.
  await page.goto("/basket/memory");
  await page.getByRole("button", { name: "Show the key and QR code" }).click();
  await expect(page.getByRole("img", { name: /QR code that opens this basket/ })).toBeVisible();

  // A shared card shows only its numbers.
  await page.goto("/share/eyJyIjowLjA4NywidSI6bnVsbCwiYyI6Ik5HTiIsInMiOiIyMDI2LTEwLTAzIiwibiI6NH0");
  await expect(page.getByText("+8.7%")).toBeVisible();
  await expect(page.getByRole("link", { name: "Measure your own basket" })).toBeVisible();
});

test("opening a basket from a shared link", async ({ page, context }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  const key = (await page.locator("code").textContent())!;
  await context.clearCookies();
  await page.goto(`/open#${key}`);
  await page.waitForURL(/\/basket$/);
  expect(page.url()).not.toContain(key);
  await expect(page.getByRole("heading", { name: "Your basket is empty" })).toBeVisible();
});
