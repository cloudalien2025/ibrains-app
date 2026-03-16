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

test.describe("DirectoryIQ SERP-informed content structure contract", () => {
  test("renders deterministic recommendations and no-structure state", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route("**/api/directoryiq/integrations", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(integrationsResponse) });
    });

    const supportResponse = {
      ok: true,
      support: {
        listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
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
        listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
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
            type: "missing_comparison_content",
            severity: "high",
            title: "Missing comparison support",
            explanation: "Missing.",
            evidenceSummary: "No comparison slot found.",
          },
          {
            type: "mentions_without_links",
            severity: "medium",
            title: "Mentions without links",
            explanation: "Mentions.",
            evidenceSummary: "Mentions without links: 2.",
          },
        ],
      },
    };

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
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalActions: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "actions_recommended",
            },
            items: [
              { key: "add_flywheel_links", priority: "high", title: "Add flywheel links", rationale: "", evidenceSummary: "" },
              { key: "create_comparison_support_content", priority: "medium", title: "Comparison", rationale: "", evidenceSummary: "" },
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
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalRecommendations: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "flywheel_opportunities_found",
            },
            items: [
              {
                key: "missing_reciprocal_link:blog-1->321",
                type: "missing_reciprocal_link",
                priority: "high",
                title: "Missing reciprocal",
                rationale: "",
                evidenceSummary: "",
                sourceEntity: { id: "blog-1", type: "blog_post", title: "Guide", url: "https://example.com/blog/guide" },
                targetEntity: { id: listingId, type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme-plumbing" },
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
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalClusters: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:04.000Z",
              dataStatus: "clusters_identified",
            },
            items: [
              { id: "reinforce_decision_stage_content", title: "Decision", priority: "high", rationale: "", evidenceSummary: "" },
            ],
          },
        }),
      });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}/reinforcement-plan**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          reinforcementPlan: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalPlanItems: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:05.000Z",
              dataStatus: "plan_items_identified",
            },
            items: [
              {
                id: "publish_comparison_decision_post",
                title: "Publish a comparison decision-stage post",
                priority: "high",
                rationale: "Selection-stage users need comparison context.",
                evidenceSummary: "Comparison gap: yes.",
                suggestedContentPurpose: "Help users evaluate alternatives.",
                suggestedTargetSurface: "comparison",
              },
            ],
          },
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/content-structure**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          contentStructure: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalRecommendations: 1,
              highPriorityCount: 1,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:06.000Z",
              dataStatus: "structure_recommendations_identified",
              serpPatternStatus: "patterns_available",
              serpPatternSource: "serp_cache",
            },
            serpPatternSummary: {
              readySlotCount: 1,
              totalSlotCount: 1,
              commonHeadings: ["Cost Factors"],
              commonQuestions: ["what is included"],
              targetLengthBand: { min: 1000, median: 1400, max: 1800 },
            },
            items: [
              {
                id: "structure_decision_comparison",
                key: "structure_decision_comparison",
                title: "Decision comparison structure",
                priority: "high",
                recommendedContentType: "comparison_page",
                recommendedTitlePattern: "Acme Plumbing: comparison and fit guide",
                suggestedH1: "Acme Plumbing: Compare Options and Select with Confidence",
                suggestedH2Structure: ["Who this listing is best for", "Comparison criteria matrix"],
                comparisonCriteria: ["price", "service scope"],
                faqThemes: ["what is included"],
                localModifiers: ["Denver"],
                entityCoverageTargets: ["Acme Plumbing", "service scope"],
                internalLinkOpportunities: [
                  "comparison-page -> https://example.com/listings/acme-plumbing",
                  "listing -> decision support module -> comparison-page",
                ],
                whyThisStructureMatters: "This structure aligns with decision-stage intent and improves selection confidence.",
                rationale: "SERP and reinforcement signals indicate users need explicit side-by-side decision framing.",
                evidenceSummary: "Comparison gap: yes; decision cluster: yes; reinforcement item: present.",
                suggestedStructureType: "comparison_matrix",
                suggestedSections: ["Who this listing is best for", "Comparison criteria matrix"],
                suggestedComponents: ["comparison-table", "decision-checklist"],
                linkedReinforcementItemIds: ["publish_comparison_decision_post"],
                linkedIntentClusterIds: ["reinforce_decision_stage_content"],
                serpPatternSummary: {
                  commonHeadings: ["Cost Factors"],
                  commonQuestions: ["what is included"],
                },
              },
            ],
          },
          meta: {
            source: "first_party_serp_content_structure_v2",
            evaluatedAt: "2026-03-10T00:00:06.000Z",
            dataStatus: "structure_recommendations_identified",
            serpPatternStatus: "patterns_available",
            serpPatternSource: "serp_cache",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-generate-content").click();
    await expect(page.getByRole("heading", { name: "Step 2: Create Support" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Recommended asset type: comparison_page")).toHaveCount(0);
    await expect(page.getByText("No major structure recommendations identified.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate SERP-informed content structure.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/content-structure**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/content-structure**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          contentStructure: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalRecommendations: 0,
              highPriorityCount: 0,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:06.000Z",
              dataStatus: "no_major_structure_recommendations_identified",
              serpPatternStatus: "patterns_unavailable",
              serpPatternSource: "none",
            },
            items: [],
          },
          meta: {
            source: "first_party_serp_content_structure_v2",
            evaluatedAt: "2026-03-10T00:00:06.000Z",
            dataStatus: "no_major_structure_recommendations_identified",
            serpPatternStatus: "patterns_unavailable",
            serpPatternSource: "none",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-generate-content").click();
    await expect(page.getByRole("heading", { name: "Step 2: Create Support" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No major structure recommendations identified.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate SERP-informed content structure.")).toHaveCount(0);
  });
});
