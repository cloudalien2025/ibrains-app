import { expect, test } from "@playwright/test";

const listingId = "321";

const listingResponse = {
  listing: {
    listing_id: listingId,
    listing_name: "Acme Plumbing",
    listing_url: "https://example.com/listings/acme-plumbing",
    mainImageUrl: null,
  },
  evaluation: {
    totalScore: 78,
  },
};

const integrationsResponse = {
  openaiConfigured: true,
  bdConfigured: true,
};

test.describe("DirectoryIQ authority gaps contract", () => {
  test("renders structured gaps and intentional no-gap state", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route("**/api/directoryiq/integrations", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(integrationsResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/support**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          support: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              inboundLinkedSupportCount: 0,
              mentionWithoutLinkCount: 0,
              outboundSupportLinkCount: 0,
              connectedSupportPageCount: 0,
              lastGraphRunAt: "2026-03-10T00:00:00.000Z",
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
    const gapsBody = {
      ok: true,
      gaps: {
        listing: {
          id: listingId,
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme-plumbing",
          siteId: "site-1",
        },
        summary: {
          totalGaps: 2,
          highCount: 1,
          mediumCount: 1,
          lowCount: 0,
          evaluatedAt: "2026-03-10T00:00:01.000Z",
          lastGraphRunAt: "2026-03-10T00:00:00.000Z",
          dataStatus: "gaps_found",
        },
        items: [
          {
            type: "no_linked_support_posts",
            severity: "high",
            title: "No support posts are linking to this listing",
            explanation: "Authority flow into this listing is missing.",
            evidenceSummary: "Inbound linked support count is 0.",
          },
          {
            type: "missing_comparison_content",
            severity: "medium",
            title: "Missing comparison support content",
            explanation: "No comparison-focused authority content is prepared for this listing.",
            evidenceSummary: "No draft or published comparison slot found.",
          },
        ],
      },
      meta: {
        source: "first_party_authority_gaps_v1",
        evaluatedAt: "2026-03-10T00:00:01.000Z",
        dataStatus: "gaps_found",
      },
    };
    await page.route(`**/api/directoryiq/listings/${listingId}/gaps**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(gapsBody),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Authority Gaps" })).toBeVisible();
    await expect(page.getByText("No support posts are linking to this listing")).toBeVisible();
    await expect(page.getByText("Missing comparison support content")).toBeVisible();
    await expect(page.getByText("No major authority gaps found for this listing.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate authority gaps.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/gaps**`);
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

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Authority Gaps" })).toBeVisible();
    await expect(page.getByText("No major authority gaps found for this listing.")).toBeVisible();
    await expect(page.getByText("Failed to evaluate authority gaps.")).toHaveCount(0);
  });
});
