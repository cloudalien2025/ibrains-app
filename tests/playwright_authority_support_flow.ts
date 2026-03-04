import { chromium } from "playwright";

async function run() {
  const baseUrl = process.env.DIRECTORYIQ_UI_BASE_URL || "http://127.0.0.1:3001";
  const listingId = process.env.DIRECTORYIQ_UI_LISTING_ID || "321";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/directoryiq/listings/${encodeURIComponent(listingId)}`, {
    waitUntil: "networkidle",
  });

  await page.getByPlaceholder("Post title").first().fill("Authority Draft Test");
  await page.getByPlaceholder("Focus topic").first().fill("Best local options");

  await page.getByRole("button", { name: "Generate Draft" }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Generate Featured Image" }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Preview" }).first().click();
  await page.waitForSelector("text=Diff Preview", { timeout: 10_000 });

  await browser.close();
}

run().catch((error) => {
  console.error("[playwright-authority-support]", error);
  process.exit(1);
});
