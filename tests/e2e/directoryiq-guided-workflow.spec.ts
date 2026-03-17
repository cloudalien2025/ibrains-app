import { expect, test } from "@playwright/test";

const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
const listingIds = ["3", "6", "29"] as const;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

test.describe("DirectoryIQ guided listing optimization workflow", () => {
  for (const listingId of listingIds) {
    test(`shows guided workflow for listing ${listingId}`, async ({ page }) => {
      await page.goto(`/directoryiq/listings/${listingId}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("authority-map-zone")).toBeVisible();
      await expect(page.getByTestId("listing-step-switcher-desktop")).toBeVisible();
      await expect(page.locator("[data-testid^='listing-step-nav-desktop-']")).toHaveCount(3);

      await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible();
      await page.getByTestId("listing-step-nav-desktop-generate-content").click();
      await expect(page.getByRole("heading", { name: "Step 2: Create Support" })).toBeVisible();
      await page.getByTestId("listing-step-nav-desktop-optimize-listing").click();
      await expect(page.getByRole("heading", { name: "Step 3: Optimize Listing" })).toBeVisible();

      await expect(page.getByTestId("listing-hero-node")).toBeVisible();
      await expect(page.getByTestId("publish-execution-layer")).toHaveCount(0);

      const defaultViewText = await page.locator("body").innerText();
      expect(defaultViewText).not.toMatch(uuidPattern);
      expect(defaultViewText).not.toContain("Step order: Find Support -> Create Support -> Optimize Listing");
      expect(defaultViewText).not.toContain("Recommendation type:");
    });
  }
});

test.describe("DirectoryIQ guided listing optimization workflow mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps step navigation reachable on narrow viewport", async ({ page }) => {
    await page.goto(`/directoryiq/listings/${listingIds[0]}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("authority-map-zone")).toBeVisible();
    await expect(page.getByTestId("listing-mission-header")).toHaveCount(0);
    await expect(page.getByTestId("listing-step-switcher-desktop")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-make-connections")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible();
    await expect(page.getByTestId("listing-mission-progress-percent")).not.toHaveText("100%");

    const mapZoneBox = await page.getByTestId("authority-map-zone").boundingBox();
    const detailsBox = await page.getByTestId("authority-details-drawer").boundingBox();
    expect(mapZoneBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();
    expect((mapZoneBox?.y ?? 0) + (mapZoneBox?.height ?? 0)).toBeLessThanOrEqual((detailsBox?.y ?? 0) + 2);

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const maxWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
      return maxWidth > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.getByTestId("listing-step-nav-desktop-generate-content").click();
    await expect(page.getByRole("heading", { name: "Step 2: Create Support" })).toBeVisible();
    await expect(page.getByTestId("publish-execution-layer")).toBeVisible();
  });
});
