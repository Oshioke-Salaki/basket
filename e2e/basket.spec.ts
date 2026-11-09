import { expect, test, type Page } from "@playwright/test";
import { fixtureImage } from "./receipt-images";

async function scan(page: Page, marker: string) {
  await page.goto("/basket/scan");
  await page.locator('input[type="file"]').setInputFiles(fixtureImage(marker));
  await page.waitForURL(/\/basket\/receipts\/[0-9a-f-]+\?(new|duplicate)=1/);
}

test("a household's basket learns from receipt to receipt", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  await expect(page.getByRole("heading", { name: "Your basket is ready" })).toBeVisible();
  await expect(page.locator("code")).toHaveText(/^bsk_[a-z2-7]{26}$/);
  await page.getByRole("button", { name: "Scan your first receipt" }).click();
  await expect(page.getByRole("heading", { name: "Scan a receipt" })).toBeVisible();

  // First receipt: nothing to compare with yet.
  await scan(page, "0");
  await expect(page.getByRole("heading", { name: "Shoprite Lekki" })).toBeVisible();
  await expect(page.getByText("Every price here is now remembered.")).toBeVisible();
  await expect(page.getByText("First time").first()).toBeVisible();

  // Second receipt, another store, two weeks later: cheaper than usual.
  await scan(page, "1");
  await expect(page.getByRole("heading", { name: "Market Square Ajah" })).toBeVisible();
  await expect(page.getByText(/under usual/).first()).toBeVisible();

  // Third receipt: rises, a cheaper store, and a shrunken pack.
  await scan(page, "2");
  await expect(page.getByText(/over usual/).first()).toBeVisible();
  await expect(page.getByText("Cheaper at Market Square Ajah").first()).toBeVisible();
  await expect(page.getByText("Smaller pack", { exact: true })).toBeVisible();
  await expect(page.getByText(/Basket learned \d+ things? from this receipt/)).toBeVisible();

  // The same receipt with memory switched off is just a list of prices.
  await page.getByRole("radio", { name: "Without memory" }).click();
  await expect(page.getByText("Without memory, every item is new.")).toBeVisible();
  await expect(page.getByText("Smaller pack", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "With memory" }).click();
  await expect(page.getByText("Smaller pack", { exact: true })).toBeVisible();

  // Writes land on (fake) Walrus and show their blob.
  await expect(page.getByText(/Stored on Walrus as blob/)).toBeVisible({ timeout: 20_000 });

  // Scanning the same receipt again is recognised.
  await scan(page, "2");
  await expect(page.getByText("This receipt was already in your basket")).toBeVisible();

  // Overview: personal inflation and the stores ranking.
  await page.goto("/basket");
  await expect(page.getByText(/Your basket inflation, in NGN/)).toBeVisible();
  await expect(page.getByText("Cheapest", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "USD" }).click();
  await expect(page.getByText(/Your basket inflation, in US dollars/)).toBeVisible();

  // Runway reads a wallet through (fake) Tatum.
  await page.getByLabel("Sui wallet address").fill("0x" + "a".repeat(64));
  await page.getByRole("button", { name: "Count the weeks" }).click();
  await expect(page.getByText(/weeks of your groceries/)).toBeVisible();
  await page.getByLabel("Sui wallet address").fill("not-an-address");
  await page.getByRole("button", { name: "Count the weeks" }).click();
  await expect(page.getByText(/That is not a Sui address/)).toBeVisible();

  // Items and an item's history.
  await page.goto("/basket/items");
  await page.getByRole("link", { name: "Mama Gold Rice" }).click();
  await expect(page.getByRole("heading", { name: "Mama Gold Rice" })).toBeVisible();
  await expect(page.getByText("Every purchase")).toBeVisible();

  // Join two names into one product; the history follows.
  await page.goto("/basket/items/indomie-chicken-noodles");
  await page.getByLabel("The same product as").selectOption("dangote-sugar");
  await page.getByRole("button", { name: "Join the two items" }).click();
  await page.waitForURL(/\/basket\/items\/dangote-sugar$/);
  await expect(page.getByText("2×").first()).toBeVisible();

  // Memory page: beliefs, proof read through Tatum, and the key.
  await page.goto("/basket/memory");
  await expect(page.getByText("What Basket believes now")).toBeVisible();
  await expect(page.getByText(/Two names, one product/)).toBeVisible();
  await expect(page.getByText("Latest checkpoint")).toBeVisible();
  await page.getByRole("button", { name: "Show the key and QR code" }).click();
  await expect(page.locator("code")).toHaveText(/^bsk_/);
});

test("an unreadable photo explains itself and nothing is saved", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start a new basket" }).click();
  await page.getByRole("button", { name: "Scan your first receipt" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixtureImage("unreadable"));
  await expect(page.getByText("That receipt could not be read")).toBeVisible();
  await expect(page.getByText(/photo of a cat/)).toBeVisible();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket is empty" })).toBeVisible();
});

test("a browser without a basket is sent to start, and a wrong key is refused", async ({ page }) => {
  await page.goto("/basket");
  await page.waitForURL(/\/start$/);
  await page.getByRole("button", { name: "Open it with your key" }).click();
  await page.getByLabel("Basket key").fill("not-a-key");
  await page.getByRole("button", { name: "Open my basket" }).click();
  await expect(page.getByText(/not a basket key/)).toBeVisible();
});
