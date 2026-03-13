import { expect, test } from "@playwright/test";

const listingId = "321";

const MOBILE_ROUTES = [
  "/directoryiq",
  "/directoryiq/listings",
  `/directoryiq/listings/${listingId}`,
  "/directoryiq/authority",
  "/directoryiq/graph-integrity",
  "/directoryiq/signal-sources",
  "/directoryiq/versions",
  "/directoryiq/authority/blogs",
  "/directoryiq/authority/listings",
  "/directoryiq/authority/integrity",
  "/directoryiq/authority-support",
  "/directoryiq/authority/authority-support",
] as const;

test.describe("DirectoryIQ mobile header unification", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every representative DirectoryIQ route uses one shared mobile header with nav drawer", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Acme Plumbing",
            listing_url: "https://example.com/listings/acme-plumbing",
            mainImageUrl: null,
          },
          evaluation: {
            totalScore: 78,
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Acme Plumbing",
            listing_url: "https://example.com/listings/acme-plumbing",
            mainImageUrl: null,
          },
          evaluation: {
            totalScore: 78,
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/support**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          support: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
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
            source: "first_party_graph_v1",
            evaluatedAt: "2026-03-10T00:00:01.000Z",
            dataStatus: "no_support_data",
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/gaps**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          gaps: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalGaps: 0,
              highCount: 0,
              mediumCount: 0,
              lowCount: 0,
              evaluatedAt: "2026-03-10T00:00:01.000Z",
              lastGraphRunAt: null,
              dataStatus: "no_meaningful_gaps",
            },
            items: [],
          },
          meta: {
            source: "first_party_authority_gaps_v1",
            evaluatedAt: "2026-03-10T00:00:01.000Z",
            dataStatus: "no_meaningful_gaps",
          },
        }),
      });
    });
    await page.route("**/api/directoryiq/integrations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          openaiConfigured: true,
          bdConfigured: true,
        }),
      });
    });

    for (const route of MOBILE_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      const mobileHeader = page.getByTestId("directoryiq-mobile-header");
      const trigger = page.getByTestId("directoryiq-mobile-menu-trigger");

      await expect(mobileHeader).toBeVisible();
      await expect(mobileHeader.getByText("DirectoryIQ")).toBeVisible();
      await expect(trigger).toBeVisible();
      await expect(page.getByRole("button", { name: "Toggle DirectoryIQ navigation" })).toHaveCount(1);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click({ force: true });
        try {
          await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1500 });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      await expect(mobileHeader.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10_000 });
      await expect(mobileHeader.getByRole("link", { name: "Listings" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Authority" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Graph Integrity" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Connections" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "History" })).toBeVisible();
      await trigger.click({ force: true });
      await expect(mobileHeader.getByRole("link", { name: "Dashboard" })).toBeHidden();
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/directoryiq/listings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("directoryiq-mobile-header")).toBeHidden();
    await expect(page.getByRole("button", { name: "Toggle DirectoryIQ navigation" })).toHaveCount(0);
  });
});
