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

const supportResponse = {
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
    mentionsWithoutLinks: [],
    outboundSupportLinks: [],
    connectedSupportPages: [],
  },
};

const gapsResponse = {
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
        type: "mentions_without_links",
        severity: "medium",
        title: "Mentions exist without links",
        explanation: "Mentions are unlinked.",
        evidenceSummary: "Mentions without links: 2.",
      },
      {
        type: "no_listing_to_support_links",
        severity: "high",
        title: "No reciprocal links",
        explanation: "No outbound links.",
        evidenceSummary: "Outbound support links: 0.",
      },
    ],
  },
};

test.describe("DirectoryIQ selection intent clusters contract", () => {
  test("renders deterministic cluster and no-cluster states", async ({ page }) => {
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(supportResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/gaps**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gapsResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/actions**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          actions: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalActions: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "actions_recommended",
            },
            items: [
              {
                key: "add_flywheel_links",
                priority: "high",
                title: "Add flywheel links",
                rationale: "Need reciprocal links.",
                evidenceSummary: "Outbound support links: 0.",
              },
              {
                key: "generate_reinforcement_post",
                priority: "medium",
                title: "Generate one reinforcement post",
                rationale: "Need support coverage.",
                evidenceSummary: "Inbound links are low.",
              },
            ],
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
              totalRecommendations: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "flywheel_opportunities_found",
            },
            items: [
              {
                key: "blog_posts_should_link_to_listing:blog-1->321",
                type: "blog_posts_should_link_to_listing",
                priority: "high",
                title: "Blog post should link directly",
                rationale: "Mention without link.",
                evidenceSummary: "Detected mention without link.",
                sourceEntity: {
                  id: "blog-1",
                  type: "blog_post",
                  title: "Guide",
                  url: "https://example.com/blog/guide",
                },
                targetEntity: {
                  id: listingId,
                  type: "listing",
                  title: "Acme Plumbing",
                  url: "https://example.com/listings/acme-plumbing",
                },
              },
            ],
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/intent-clusters**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          intentClusters: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalClusters: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "clusters_identified",
            },
            items: [
              {
                id: "close_unlinked_support_mentions",
                title: "Close unlinked support mentions",
                priority: "high",
                rationale: "Selection-stage confidence drops when mentions stay unlinked.",
                evidenceSummary: "Mentions without links: 2.",
                linkedGapTypes: ["mentions_without_links"],
                linkedActionKeys: ["add_flywheel_links"],
                linkedFlywheelTypes: ["blog_posts_should_link_to_listing"],
                suggestedReinforcementDirection: {
                  surface: "blog",
                  direction: "Convert the strongest unlinked mentions into direct listing links.",
                },
              },
              {
                id: "repair_bidirectional_flywheel_links",
                title: "Repair bidirectional flywheel links",
                priority: "medium",
                rationale: "Selection flows need reciprocal support pathways.",
                evidenceSummary: "Outbound support links: 0.",
                linkedGapTypes: ["no_listing_to_support_links"],
                linkedActionKeys: ["add_flywheel_links"],
                linkedFlywheelTypes: ["missing_reciprocal_link"],
                suggestedReinforcementDirection: {
                  surface: "listing",
                  direction: "Add contextual links back to top support posts.",
                },
              },
            ],
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Recommended Improvements" }).click();
    await expect(page.getByRole("heading", { name: "AI Selection Opportunities" })).toBeVisible();
    await expect(page.getByText("Close unlinked support mentions")).toBeVisible();
    await expect(page.getByText("Repair bidirectional flywheel links")).toBeVisible();
    await expect(page.getByText("No major reinforcement intent clusters identified.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate selection intent clusters.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/intent-clusters**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/intent-clusters**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          intentClusters: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              totalClusters: 0,
              highPriorityCount: 0,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "no_major_reinforcement_intent_clusters_identified",
            },
            items: [],
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Recommended Improvements" }).click();
    await expect(page.getByRole("heading", { name: "AI Selection Opportunities" })).toBeVisible();
    await expect(page.getByText("No major reinforcement intent clusters identified.")).toBeVisible();
    await expect(page.getByText("Failed to evaluate selection intent clusters.")).toHaveCount(0);
  });
});
