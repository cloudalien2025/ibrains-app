import { chromium } from "playwright";

async function run() {
  const baseUrl = process.env.DIRECTORYIQ_UI_BASE_URL || "http://127.0.0.1:3001";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/directoryiq/settings/integrations`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Configure" }).first().click();
  await page.getByPlaceholder("Base URL (e.g. https://your-bd-site.com)").fill("https://example.com");
  await page.getByPlaceholder("X-Api-Key").fill("bd_test_key");
  await page.getByRole("button", { name: "Save" }).first().click();

  await page.getByRole("button", { name: "Edit" }).nth(1).click();
  await page.getByPlaceholder("OpenAI API key").fill("sk-test");
  await page.getByRole("button", { name: "Cancel" }).first().click();

  await browser.close();
}

run().catch((error) => {
  console.error("[playwright-directoryiq-integrations]", error);
  process.exit(1);
});
