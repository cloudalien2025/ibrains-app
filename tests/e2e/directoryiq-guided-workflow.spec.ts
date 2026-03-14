import { expect, test } from "@playwright/test";

const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
const listingIds = ["3", "6", "29"] as const;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

test.describe("DirectoryIQ guided listing optimization workflow", () => {
  for (const listingId of listingIds) {
    test(`shows guided workflow for listing ${listingId}`, async ({ page }) => {
      await page.goto(`/directoryiq/listings/${listingId}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Step 1: Audit this listing" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Step 2: Connect existing pages" })).not.toBeVisible();

      await page.getByTestId("listing-step-nav-desktop-connect-existing-pages").click();
      await expect(page.getByRole("heading", { name: "Step 2: Connect existing pages" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Step 1: Audit this listing" })).not.toBeVisible();

      await page.getByTestId("listing-step-nav-desktop-create-support-content").click();
      await expect(page.getByRole("heading", { name: "Step 3: Create support content" })).toBeVisible();

      await page.getByTestId("listing-step-nav-desktop-upgrade-the-listing").click();
      await expect(page.getByRole("heading", { name: "Step 4: Upgrade the listing" })).toBeVisible();

      await page.getByTestId("listing-step-nav-desktop-launch-and-measure").click();
      await expect(page.getByRole("heading", { name: "Step 5: Launch and measure" })).toBeVisible();

      await expect(page.getByTestId("directoryiq-hero-image")).toBeVisible();

      const defaultViewText = await page.locator("body").innerText();
      expect(defaultViewText).not.toMatch(uuidPattern);
      expect(defaultViewText).not.toContain("->");
      expect(defaultViewText).not.toContain("Recommendation type:");
    });
  }
});

test.describe("DirectoryIQ guided listing optimization workflow mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps step navigation reachable on narrow viewport", async ({ page }) => {
    await page.goto(`/directoryiq/listings/${listingIds[0]}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("listing-step-nav-mobile-toggle")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-mobile-audit")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 1: Audit this listing" })).toBeVisible();
    await expect(page.getByTestId("listing-mission-progress-percent")).not.toHaveText("100%");

    const stickyStripPosition = await page.getByTestId("listing-mobile-sticky-strip").evaluate(
      (node) => window.getComputedStyle(node).position
    );
    expect(stickyStripPosition).toBe("sticky");

    await expect(page.getByTestId("listing-summary-cards")).not.toBeVisible();
    await expect(page.getByText("Current step: Step", { exact: false })).not.toBeVisible();

    await page.getByTestId("listing-step-nav-mobile-toggle").click();
    await expect(page.getByTestId("listing-step-nav-mobile-audit")).toBeVisible();
    await page.getByTestId("listing-step-nav-mobile-launch-and-measure").click();
    await expect(page.getByRole("heading", { name: "Step 5: Launch and measure" })).toBeVisible();

    await page.getByTestId("listing-step-back").click();
    await expect(page.getByRole("heading", { name: "Step 4: Upgrade the listing" })).toBeVisible();
  });
});
