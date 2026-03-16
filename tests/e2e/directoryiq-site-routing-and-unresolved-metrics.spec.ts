import { expect, test } from "@playwright/test";

const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
const listingId = "3";

test.describe("DirectoryIQ site routing and unresolved metrics contract", () => {
  test("uses real site routing with no Default option and truthful unresolved gap state", async ({ page }) => {
    const supportRequestUrls: string[] = [];
    const gapsRequestUrls: string[] = [];

    await page.route("**/api/directoryiq/sites", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sites: [
            {
              id: siteId,
              label: "VailVacay",
              baseUrl: "https://www.vailvacay.com",
              enabled: true,
            },
          ],
          is_admin: false,
        }),
      });
    });

    await page.route(/\/api\/directoryiq\/listings(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          listings: [
            {
              listing_id: listingId,
              listing_name: "Onion playground in Lionshead Square",
              url: "https://www.vailvacay.com/listings/onion-playground",
              score: 64,
              pillars: {
                structure: 60,
                clarity: 62,
                trust: 63,
                authority: 58,
                actionability: 66,
              },
              authority_status: "needs_support",
              trust_status: "needs_trust",
              last_optimized: null,
              site_id: siteId,
              site_label: "VailVacay",
              category: "Playgrounds",
              group_category: "Playgrounds",
            },
          ],
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}?site_id=${siteId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Onion playground in Lionshead Square",
            listing_url: "https://www.vailvacay.com/listings/onion-playground",
            mainImageUrl: null,
          },
          evaluation: {
            totalScore: 64,
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
      supportRequestUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          support: {
            listing: {
              id: listingId,
              title: "Onion playground in Lionshead Square",
              canonicalUrl: null,
              siteId,
            },
            summary: {
              inboundLinkedSupportCount: 0,
              mentionWithoutLinkCount: 0,
              outboundSupportLinkCount: 0,
              connectedSupportPageCount: 0,
              lastGraphRunAt: null,
            },
            inboundLinkedSupport: [],
            mentionsWithoutLinks: [],
            outboundSupportLinks: [],
            connectedSupportPages: [],
          },
          meta: {
            source: "local_support_service_v1",
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "no_support_data",
          },
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/gaps?site_id=${siteId}`, async (route) => {
      gapsRequestUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          gaps: {
            listing: {
              id: listingId,
              title: "Onion playground in Lionshead Square",
              canonicalUrl: null,
              siteId,
            },
            summary: {
              totalGaps: 0,
              highCount: 0,
              mediumCount: 0,
              lowCount: 0,
              evaluatedAt: "2026-03-13T00:00:00.000Z",
              lastGraphRunAt: null,
              dataStatus: "analysis_unavailable",
            },
            items: [],
          },
          meta: {
            source: "directoryiq_support_derived_gaps_v1",
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "analysis_unavailable",
            supportDataStatus: "no_support_data",
          },
        }),
      });
    });

    await page.goto("/directoryiq/listings", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Default")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Improve" })).toBeVisible();
    await page.getByRole("link", { name: "Improve" }).click();

    await expect(page).toHaveURL(new RegExp(`/directoryiq/listings/${listingId}\\?site_id=${siteId}`));
    await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("listing-mission-header")).toHaveCount(0);
    await expect(page.getByTestId("authority-map-zone")).toBeVisible();
    await expect(page.getByText("Biggest blocker")).toBeVisible();
    await expect(page.getByText("Fastest win")).toBeVisible();
    await expect(page.getByText("Gap analysis is not available yet.")).toHaveCount(0);
    await expect(page.getByText("No major visibility gaps found for this listing.")).toHaveCount(0);
    await expect(page.getByText("Flywheel evaluation is not available until support and gap diagnostics finish.")).toBeVisible();
    await expect(page.getByTestId("step1-real-existing-connections")).toBeVisible();
    await expect(page.getByTestId("step1-real-mentions-without-links")).toBeVisible();
    await expect(page.getByTestId("step1-derived-recommendations")).toBeVisible();
    await expect(page.getByTestId("step1-validity-summary")).toBeVisible();
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Valid support posts found:");
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Upgrade candidates:");
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Missing support types:");
    expect(supportRequestUrls.some((url) => url.includes(`site_id=${siteId}`))).toBe(true);
    expect(gapsRequestUrls.some((url) => url.includes(`site_id=${siteId}`))).toBe(true);
  });
});
