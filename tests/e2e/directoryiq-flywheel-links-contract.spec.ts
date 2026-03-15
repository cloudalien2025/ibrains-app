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

test.describe("DirectoryIQ flywheel links contract", () => {
  test("renders deterministic flywheel recommendations and no-opportunity state", async ({ page }) => {
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
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              inboundLinkedSupportCount: 0,
              mentionWithoutLinkCount: 2,
              outboundSupportLinkCount: 0,
              connectedSupportPageCount: 0,
              lastGraphRunAt: "2026-03-10T00:00:00.000Z",
            },
            inboundLinkedSupport: [],
            mentionsWithoutLinks: [
              {
                sourceId: "blog-2",
                sourceType: "blog_post",
                title: "Emergency plumbing checklist",
                url: "https://example.com/blog/emergency-checklist",
                mentionSnippet: "Acme Plumbing serves this area.",
                relationshipType: "mentions_without_link",
              },
            ],
            outboundSupportLinks: [],
            connectedSupportPages: [],
          },
          meta: {
            source: "first_party_graph_v1",
            evaluatedAt: "2026-03-10T00:00:01.000Z",
            dataStatus: "supported",
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
              totalGaps: 3,
              highCount: 1,
              mediumCount: 1,
              lowCount: 1,
              evaluatedAt: "2026-03-10T00:00:01.000Z",
              lastGraphRunAt: "2026-03-10T00:00:00.000Z",
              dataStatus: "gaps_found",
            },
            items: [
              {
                type: "mentions_without_links",
                severity: "medium",
                title: "Mentions without links",
                explanation: "Mentions exist without direct links.",
                evidenceSummary: "2 mentions without links.",
              },
              {
                type: "no_listing_to_support_links",
                severity: "high",
                title: "No reciprocal links",
                explanation: "Listing has no outbound support links.",
                evidenceSummary: "Outbound support links: 0.",
              },
              {
                type: "weak_category_support",
                severity: "low",
                title: "Weak category support",
                explanation: "Category support is weak.",
                evidenceSummary: "Low support hit count.",
              },
            ],
          },
          meta: {
            source: "first_party_authority_gaps_v1",
            evaluatedAt: "2026-03-10T00:00:01.000Z",
            dataStatus: "gaps_found",
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/actions**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          actions: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalActions: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "actions_recommended",
            },
            items: [
              {
                key: "add_flywheel_links",
                priority: "high",
                title: "Add flywheel links between listing and support assets",
                rationale: "Bidirectional links are required for stable authority circulation.",
                evidenceSummary: "Mentions without links: 2; outbound support links: 0.",
              },
            ],
          },
          meta: {
            source: "first_party_recommended_actions_v1",
            evaluatedAt: "2026-03-10T00:00:02.000Z",
            dataStatus: "actions_recommended",
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/flywheel-links**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          flywheel: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalRecommendations: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "flywheel_opportunities_found",
            },
            items: [
              {
                key: "blog_posts_should_link_to_listing:blog-2->321",
                type: "blog_posts_should_link_to_listing",
                priority: "high",
                title: "Blog post should link directly to the listing",
                rationale: "This support post mentions the listing but does not pass authority with a direct link.",
                evidenceSummary: "Detected mention without link in support content.",
                sourceEntity: {
                  id: "blog-2",
                  type: "blog_post",
                  title: "Emergency plumbing checklist",
                  url: "https://example.com/blog/emergency-checklist",
                },
                targetEntity: {
                  id: listingId,
                  type: "listing",
                  title: "Acme Plumbing",
                  url: "https://example.com/listings/acme-plumbing",
                },
              },
              {
                key: "category_or_guide_page_should_join_cluster:321",
                type: "category_or_guide_page_should_join_cluster",
                priority: "medium",
                title: "Add a category or guide page into the link cluster",
                rationale: "Cluster-level support pages improve authority circulation.",
                evidenceSummary: "Connected support pages: 0; gaps: 3.",
                sourceEntity: {
                  id: listingId,
                  type: "listing",
                  title: "Acme Plumbing",
                  url: "https://example.com/listings/acme-plumbing",
                },
                targetEntity: {
                  id: "321:cluster",
                  type: "category_page",
                  title: "Category/Guide cluster node",
                  url: null,
                },
              },
            ],
          },
          meta: {
            source: "first_party_flywheel_links_v1",
            evaluatedAt: "2026-03-10T00:00:03.000Z",
            dataStatus: "flywheel_opportunities_found",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();
    await expect(page.getByText("Blog post should link directly to the listing")).toBeVisible();
    await expect(page.getByText("Missing support to generate in Step 2")).toBeVisible();
    await expect(page.getByText("Add a category or guide page into the link cluster")).toBeVisible();
    await expect(page.getByText("No major flywheel opportunities found.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate flywheel links.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/flywheel-links**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/flywheel-links**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          flywheel: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalRecommendations: 0,
              highPriorityCount: 0,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "no_major_flywheel_opportunities",
            },
            items: [],
          },
          meta: {
            source: "first_party_flywheel_links_v1",
            evaluatedAt: "2026-03-10T00:00:03.000Z",
            dataStatus: "no_major_flywheel_opportunities",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();
    await expect(page.getByText("Blog post should link directly to the listing")).toHaveCount(0);
    await expect(page.getByText("Add a category or guide page into the link cluster")).toHaveCount(0);
    await expect(page.getByText("Missing support to generate in Step 2")).toBeVisible();
    await expect(page.getByText("Failed to evaluate flywheel links.")).toHaveCount(0);
  });
});
