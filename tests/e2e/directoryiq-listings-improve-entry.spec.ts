import { expect, test, type Page } from "@playwright/test";

const siteId = "5c82f5c1-a45f-4b25-a0d4-1b749d962415";
const firstListingId = "3";
const secondListingId = "29";

async function mockListingsAndOptimizationApis(page: Page) {
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
            listing_id: firstListingId,
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
          {
            listing_id: secondListingId,
            listing_name: "Spruce Tree Lodge",
            url: "https://www.vailvacay.com/listings/spruce-tree-lodge",
            score: 86,
            pillars: {
              structure: 87,
              clarity: 83,
              trust: 85,
              authority: 88,
              actionability: 86,
            },
            authority_status: "strong",
            trust_status: "strong",
            last_optimized: "2026-03-10T12:00:00.000Z",
            site_id: siteId,
            site_label: "VailVacay",
            category: "Lodging",
            group_category: "Lodging",
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/directoryiq\/listings\/([^/]+)\?site_id=.*/, async (route) => {
    const match = route.request().url().match(/\/api\/directoryiq\/listings\/([^/?]+)/);
    const listingId = match?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        listing: {
          listing_id: listingId,
          listing_name: listingId === firstListingId ? "Onion playground in Lionshead Square" : "Spruce Tree Lodge",
          listing_url:
            listingId === firstListingId
              ? "https://www.vailvacay.com/listings/onion-playground"
              : "https://www.vailvacay.com/listings/spruce-tree-lodge",
          mainImageUrl: null,
        },
        evaluation: {
          totalScore: listingId === firstListingId ? 64 : 86,
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

  await page.route("**/api/directoryiq/listings/*/support?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        support: {
          listing: {
            id: listingId,
            title: listingId === firstListingId ? "Onion playground in Lionshead Square" : "Spruce Tree Lodge",
            canonicalUrl: null,
            siteId,
          },
          summary: {
            inboundLinkedSupportCount: 3,
            mentionWithoutLinkCount: 1,
            outboundSupportLinkCount: 2,
            connectedSupportPageCount: 3,
            lastGraphRunAt: "2026-03-12T00:00:00.000Z",
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [],
          outboundSupportLinks: [],
          connectedSupportPages: [],
        },
        meta: {
          source: "local_support_service_v1",
          evaluatedAt: "2026-03-13T00:00:00.000Z",
          dataStatus: "supported",
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/gaps?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        gaps: {
          listing: {
            id: listingId,
            title: listingId === firstListingId ? "Onion playground in Lionshead Square" : "Spruce Tree Lodge",
            canonicalUrl: null,
            siteId,
          },
          summary: {
            totalGaps: 1,
            highCount: 0,
            mediumCount: 1,
            lowCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            lastGraphRunAt: "2026-03-12T00:00:00.000Z",
            dataStatus: "gaps_found",
          },
          items: [],
        },
        meta: {
          source: "directoryiq_support_derived_gaps_v1",
          evaluatedAt: "2026-03-13T00:00:00.000Z",
          dataStatus: "gaps_found",
          supportDataStatus: "supported",
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/actions?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        actions: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalActions: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "actions_recommended",
          },
          items: [],
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/flywheel-links?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        flywheel: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalRecommendations: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "flywheel_opportunities_found",
          },
          items: [],
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/intent-clusters?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        intentClusters: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalClusters: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "clusters_identified",
          },
          items: [],
          intentProfile: {
            primaryIntent: "select_best_local_option",
            secondaryIntents: [],
            targetEntities: [],
            supportingEntities: [],
            localModifiers: [],
            comparisonFrames: [],
            supportedEntities: [],
            missingEntities: [],
            clusterPriorityRanking: [],
            confidence: "high",
            dataStatus: "intent_resolved",
          },
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/reinforcement-plan?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        reinforcementPlan: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalPlanItems: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "plan_items_identified",
          },
          items: [],
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/content-structure?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        contentStructure: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalRecommendations: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "structure_recommendations_identified",
            serpPatternStatus: "patterns_available",
            serpPatternSource: "intent_fixture",
          },
          items: [],
          serpPatternSummary: {
            readySlotCount: 1,
            totalSlotCount: 1,
            commonHeadings: [],
            commonQuestions: [],
          },
        },
      }),
    });
  });

  await page.route("**/api/directoryiq/listings/*/upgrade/multi-action?site_id=*", async (route) => {
    const listingId = route.request().url().match(/\/api\/directoryiq\/listings\/([^/]+)/)?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        multiAction: {
          listing: { id: listingId, title: "Listing", canonicalUrl: null, siteId },
          summary: {
            totalActions: 1,
            availableCount: 1,
            blockedCount: 0,
            notRecommendedCount: 0,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-13T00:00:00.000Z",
            dataStatus: "upgrade_actions_available",
          },
          grouped: {
            byReadiness: {
              ready: ["optimize-1"],
              blocked: [],
              abstained: [],
            },
            bySurface: {
              listing: ["optimize-1"],
              blog: [],
              support_page: [],
              cluster: [],
            },
          },
          items: [
            {
              actionId: "optimize-1",
              actionType: "listing_detail_improvement",
              key: "optimize_listing_description",
              title: "Optimize listing description",
              description: "Improve the listing summary and trust copy.",
              whyItMatters: "Improves conversion confidence.",
              sourceSignals: {},
              expectedImpact: "Higher selection readiness.",
              dependencies: [],
              recommendedPriority: "high",
              readinessState: "ready",
              priority: "high",
              status: "available",
              rationale: "Action is executable.",
              evidenceSummary: "Core listing fields are present.",
              targetSurface: "listing",
              previewCapability: {
                supported: true,
              },
            },
          ],
        },
      }),
    });
  });
}

test.describe("DirectoryIQ listings Improve entrypoint", () => {
  test("routes to the selected listing and always starts fresh Improve entry at Step 1", async ({ page }) => {
    await mockListingsAndOptimizationApis(page);

    await page.goto(`/directoryiq/listings/${firstListingId}?site_id=${siteId}&step=launch-and-measure`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible();

    await page.goto(`/directoryiq/listings?site_id=${siteId}`, { waitUntil: "domcontentloaded" });

    const secondRow = page.locator("tr", { has: page.getByText("Spruce Tree Lodge", { exact: true }) }).first();
    await secondRow.getByRole("link", { name: "Improve" }).click();

    await expect(page).toHaveURL(new RegExp(`/directoryiq/listings/${secondListingId}\\?site_id=${siteId}`));
    await expect(page).not.toHaveURL(/step=/);
    await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible();
    await expect(page.getByTestId("publish-execution-layer")).toHaveCount(0);
  });
});
