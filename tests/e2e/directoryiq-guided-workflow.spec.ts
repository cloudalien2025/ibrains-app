import { expect, test } from "@playwright/test";

const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
const listingIds = ["3", "6", "29"] as const;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

test.describe("DirectoryIQ guided listing optimization workflow", () => {
  for (const listingId of listingIds) {
    test(`shows guided workflow for listing ${listingId}`, async ({ page }) => {
      await page.goto(`/directoryiq/listings/${listingId}?site_id=${siteId}`, { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Step 1: What's Helping And What This Listing Should Be Known For" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Step 1: What's Helping" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Step 2: What's Missing" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Step 3: Recommended Improvements" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Step 4: Publish" })).toBeVisible();
      await expect(page.getByText("What this listing should be known for", { exact: true })).toBeVisible();

      await expect(page.getByTestId("directoryiq-hero-image")).toBeVisible();

      const defaultViewText = await page.locator("body").innerText();
      expect(defaultViewText).not.toMatch(uuidPattern);
      expect(defaultViewText).not.toContain("->");
      expect(defaultViewText).not.toContain("Recommendation type:");

      await page.getByRole("button", { name: "Step 2: What's Missing" }).click();
      await expect(page.getByRole("heading", { name: "Step 2: Find What Is Still Missing" })).toBeVisible();

      await page.getByRole("button", { name: "Step 3: Recommended Improvements" }).click();
      await expect(page.getByRole("heading", { name: "Step 3: Recommended Improvements" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "What This Listing Should Be Known For" })).toBeVisible();

      await page.getByRole("button", { name: "Step 4: Publish" }).click();
      await expect(page.getByRole("heading", { name: "Step 4: Review And Publish Improvements" })).toBeVisible();
    });
  }
});
