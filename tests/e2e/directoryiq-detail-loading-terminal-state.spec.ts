import { expect, test } from "@playwright/test";

const listingId = "651";
const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";

test.describe("DirectoryIQ listing detail terminal loading state", () => {
  test("settles metrics and steps into terminal unavailable/error state when support/gaps requests stall", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?site_id=${siteId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Tivoli Lodge",
            listing_url: "https://www.vailvacay.com/listings/tivoli-lodge",
            mainImageUrl: null,
          },
          evaluation: {
            totalScore: 73,
          },
        }),
      });
    });

    await page.route("**/api/directoryiq/signal-sources", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connectors: [
            { connector_id: "openai", connected: true },
            { connector_id: "brilliant_directories_api", connected: true },
          ],
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/support?site_id=${siteId}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          support: null,
          meta: { source: "test", evaluatedAt: new Date().toISOString(), dataStatus: "no_support_data" },
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/gaps?site_id=${siteId}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          gaps: null,
          meta: { source: "test", evaluatedAt: new Date().toISOString(), dataStatus: "analysis_unavailable" },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}?site_id=${siteId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-make-connections")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-generate-content")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-optimize-listing")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-launch-and-measure")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "What's Helping" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "What's Missing" })).toHaveCount(0);

    await expect
      .poll(async () => page.locator("body").innerText(), { timeout: 20_000 })
      .toMatch(
        /(Support diagnostics request timed out\.|Gap analysis request timed out\.|Flywheel evaluation failed because support and gaps diagnostics are unavailable\.)/i
      );
    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();
    await expect(page.getByTestId("step-make-connections")).toBeVisible();
    await expect(page.getByText("Support diagnostics are unavailable.")).toBeVisible();
    await page.getByTestId("listing-step-nav-desktop-generate-content").click();
    await expect(page.getByRole("heading", { name: "Step 2: Generate Content" })).toBeVisible();
    await page.getByTestId("listing-step-nav-desktop-optimize-listing").click();
    await expect(page.getByRole("heading", { name: "Step 3: Optimize Listing" })).toBeVisible();
    await expect(page.getByTestId("publish-execution-layer")).toBeVisible();
  });
});
