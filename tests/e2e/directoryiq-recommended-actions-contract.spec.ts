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
  meta: {
    source: "first_party_graph_v1",
    evaluatedAt: "2026-03-10T00:00:01.000Z",
    dataStatus: "supported",
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
        type: "no_linked_support_posts",
        severity: "high",
        title: "No support posts are linking to this listing",
        explanation: "Authority flow into this listing is missing.",
        evidenceSummary: "Inbound linked support count is 0.",
      },
      {
        type: "mentions_without_links",
        severity: "medium",
        title: "Mentions exist without links",
        explanation: "Mentions are unlinked.",
        evidenceSummary: "Mentions without links: 2.",
      },
    ],
  },
  meta: {
    source: "first_party_authority_gaps_v1",
    evaluatedAt: "2026-03-10T00:00:01.000Z",
    dataStatus: "gaps_found",
  },
};

test.describe("DirectoryIQ recommended actions contract", () => {
  test("renders deterministic recommended and no-action states", async ({ page }) => {
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
                key: "optimize_listing",
                priority: "high",
                title: "Optimize listing authority structure",
                rationale: "The listing should be tuned before reinforcement.",
                evidenceSummary: "Gaps: 2; inbound links: 0; outbound support links: 0.",
                linkedGapTypes: ["no_linked_support_posts", "mentions_without_links"],
                targetSurface: "listing",
              },
              {
                key: "add_flywheel_links",
                priority: "medium",
                title: "Add flywheel links between listing and support assets",
                rationale: "Bidirectional links are required for authority circulation.",
                evidenceSummary: "Mentions without links: 2; outbound support links: 0.",
                linkedGapTypes: ["mentions_without_links", "no_listing_to_support_links"],
                targetSurface: "listing",
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

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Step 3: Create support content" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Step 4: Upgrade the listing" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Optimize listing authority structure")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Run the listing audit to identify the next fast win.")).toHaveCount(0);
    await expect(page.getByText("No major actions recommended at this time.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate recommended actions.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/actions**`);
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
              totalActions: 0,
              highPriorityCount: 0,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "no_major_actions_recommended",
            },
            items: [],
          },
          meta: {
            source: "first_party_recommended_actions_v1",
            evaluatedAt: "2026-03-10T00:00:02.000Z",
            dataStatus: "no_major_actions_recommended",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Step 4: Upgrade the listing" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Run the listing audit to identify the next fast win.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Optimize listing authority structure")).toHaveCount(0);
    await expect(page.getByText("No major actions recommended at this time.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate recommended actions.")).toHaveCount(0);
  });
});
