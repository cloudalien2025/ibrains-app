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
    await expect(page.getByRole("heading", { name: "Step 1: Audit this listing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 2: Connect existing pages" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 3: Create support content" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 4: Upgrade the listing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 5: Launch and measure" })).toBeVisible();
    await expect(page.getByRole("button", { name: "What's Helping" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "What's Missing" })).toHaveCount(0);

    await expect
      .poll(async () => {
        const supportCard = page.locator("div").filter({ hasText: "Supporting links in" }).first();
        const missingCard = page.locator("div").filter({ hasText: "Total gaps" }).first();
        return {
          support: await supportCard.textContent(),
          missing: await missingCard.textContent(),
        };
      }, { timeout: 15000 })
      .toEqual(
        expect.objectContaining({
          support: expect.stringContaining("—"),
          missing: expect.stringContaining("—"),
        })
      );

    await expect(page.getByText("Loading support diagnostics...")).toHaveCount(0);
    await expect
      .poll(async () => {
        const unavailableCount = await page.getByText("Support diagnostics are not available yet.").count();
        const timeoutCount = await page.getByText("Support diagnostics request timed out.").count();
        return unavailableCount + timeoutCount;
      })
      .toBeGreaterThan(0);
    await expect(page.getByText("Evaluating visibility gaps...")).toHaveCount(0);
    await expect(page.getByText("Flywheel evaluation failed because support and gaps diagnostics are unavailable.")).toBeVisible();
    await expect(page.getByText("Reinforcement planning failed because prerequisite diagnostics are unavailable.")).toBeVisible();
    await expect(page.getByText("Multi-action upgrade evaluation failed because prerequisite diagnostics are unavailable.")).toBeVisible();
  });
});
