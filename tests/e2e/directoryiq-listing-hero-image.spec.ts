import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test.describe("DirectoryIQ listing hero image", () => {
  test("listing 321 renders hero image or deterministic fallback", async ({ page }) => {
    const listingId = "321";
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });

    const hero = page.getByTestId("directoryiq-listing-hero");
    await expect(hero).toBeVisible({ timeout: 30_000 });

    const title = hero.locator("h1");
    await expect(title).toContainText("Hotel Gasthof Gramshammer");

    const image = hero.getByTestId("directoryiq-hero-image");
    const imageCount = await image.count();

    if (imageCount > 0) {
      await expect(image.first()).toBeVisible();
      const src = await image.first().getAttribute("src");
      expect(src, "hero image src should be non-empty when image exists").toBeTruthy();
    } else {
      await expect(hero.getByText("No main image available for this listing yet.")).toBeVisible();
    }

    const outDir = path.join(process.cwd(), "artifacts", "playwright");
    await fs.mkdir(outDir, { recursive: true });
    await hero.screenshot({ path: path.join(outDir, "hero_321.png") });
  });
});
