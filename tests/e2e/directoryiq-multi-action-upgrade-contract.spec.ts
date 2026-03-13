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

test.describe("DirectoryIQ multi-action generate upgrade contract", () => {
  test("renders deterministic action system and no-action state", async ({ page }) => {
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
              { key: "optimize_listing", priority: "high", title: "Optimize", rationale: "", evidenceSummary: "" },
              { key: "add_flywheel_links", priority: "medium", title: "Flywheel", rationale: "", evidenceSummary: "" },
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
            items: [{ id: "repair_bidirectional_flywheel_links", title: "Repair", priority: "high", rationale: "", evidenceSummary: "" }],
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
            },
            items: [
              {
                id: "structure_decision_comparison",
                key: "structure_decision_comparison",
                title: "Decision comparison structure",
                priority: "high",
                rationale: "",
                evidenceSummary: "",
                suggestedStructureType: "comparison_matrix",
                suggestedSections: ["Who this is for"],
                suggestedComponents: ["comparison-table"],
              },
            ],
          },
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/multi-action**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          multiAction: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalActions: 2,
              availableCount: 2,
              blockedCount: 0,
              notRecommendedCount: 0,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:07.000Z",
              dataStatus: "upgrade_actions_available",
            },
            grouped: {
              byReadiness: {
                ready: ["optimize_listing_description", "repair_flywheel_links"],
                blocked: [],
                abstained: [],
              },
              bySurface: {
                listing: ["optimize_listing_description", "repair_flywheel_links"],
                blog: [],
                support_page: [],
                cluster: [],
              },
            },
            items: [
              {
                actionId: "optimize_listing_description",
                actionType: "listing_detail_improvement",
                key: "optimize_listing_description",
                title: "Generate and review listing description upgrade",
                description: "Draft listing updates aligned to intent and blueprint signals.",
                whyItMatters: "Listing quality is the main conversion surface.",
                sourceSignals: { primaryIntent: "hire_trusted_local_service" },
                expectedImpact: "High expected impact on conversion confidence.",
                dependencies: [],
                recommendedPriority: "high",
                readinessState: "ready",
                priority: "high",
                status: "available",
                rationale: "Keep listing copy optimization as the execution entrypoint.",
                evidenceSummary: "Authority gaps: 2.",
                targetSurface: "listing",
                previewCapability: {
                  supported: true,
                  generateEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/generate",
                  previewEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/preview",
                  pushEndpoint: "/api/directoryiq/listings/{listingId}/upgrade/push",
                  requiresApprovalToken: true,
                  requiresBdForPush: true,
                },
                previewPayload: { mode: "live_preview", detail: "Generate and preview listing detail improvements." },
              },
              {
                actionId: "repair_flywheel_links",
                actionType: "internal_link_trust_signal",
                key: "repair_flywheel_links",
                title: "Repair listing-to-support flywheel links",
                description: "Repair reciprocal links between listing and support pages.",
                whyItMatters: "Trust-signal flow requires reciprocal links.",
                sourceSignals: { primaryIntent: "hire_trusted_local_service" },
                expectedImpact: "Medium expected impact on trust pathways.",
                dependencies: [],
                recommendedPriority: "medium",
                readinessState: "ready",
                priority: "medium",
                status: "available",
                rationale: "Bidirectional links should be established.",
                evidenceSummary: "Outbound support links: 0.",
                targetSurface: "listing",
                previewCapability: {
                  supported: false,
                  note: "No dedicated preview route yet; execute via manual link/module updates.",
                },
                previewPayload: { mode: "planning_only", detail: "Link repair package for trust-signal flow." },
              },
            ],
          },
          meta: {
            source: "first_party_multi_action_upgrade_v2",
            evaluatedAt: "2026-03-10T00:00:07.000Z",
            dataStatus: "upgrade_actions_available",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Step 4: Review And Publish Improvements" })).toBeVisible();
    await expect(page.getByText("Generate and review listing description upgrade")).toBeVisible();
    await expect(page.getByText("Repair listing-to-support flywheel links")).toBeVisible();
    await expect(page.getByText("Ready Actions").first()).toBeVisible();
    await expect(page.getByText("Why it matters: Listing quality is the main conversion surface.")).toBeVisible();
    await expect(page.getByText("No major upgrade actions available.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/upgrade/multi-action**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/multi-action**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          multiAction: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalActions: 2,
              availableCount: 0,
              blockedCount: 0,
              notRecommendedCount: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:07.000Z",
              dataStatus: "no_major_upgrade_actions_available",
            },
            grouped: {
              byReadiness: {
                ready: [],
                blocked: [],
                abstained: ["optimize_listing_description", "repair_flywheel_links"],
              },
              bySurface: {
                listing: ["optimize_listing_description", "repair_flywheel_links"],
                blog: [],
                support_page: [],
                cluster: [],
              },
            },
            items: [
              {
                actionId: "optimize_listing_description",
                actionType: "listing_detail_improvement",
                key: "optimize_listing_description",
                title: "Generate and review listing description upgrade",
                description: "No-op.",
                whyItMatters: "No-op.",
                sourceSignals: {},
                expectedImpact: "None.",
                dependencies: [],
                recommendedPriority: "high",
                readinessState: "abstained",
                priority: "high",
                status: "not_recommended",
                rationale: "No major signals.",
                evidenceSummary: "Authority gaps: 0.",
                targetSurface: "listing",
                previewCapability: { supported: true },
                previewPayload: { mode: "planning_only", detail: "No-op." },
              },
              {
                actionId: "repair_flywheel_links",
                actionType: "internal_link_trust_signal",
                key: "repair_flywheel_links",
                title: "Repair listing-to-support flywheel links",
                description: "No-op.",
                whyItMatters: "No-op.",
                sourceSignals: {},
                expectedImpact: "None.",
                dependencies: [],
                recommendedPriority: "medium",
                readinessState: "abstained",
                priority: "medium",
                status: "not_recommended",
                rationale: "No major signals.",
                evidenceSummary: "Outbound support links: 2.",
                targetSurface: "listing",
                previewCapability: { supported: false },
                previewPayload: { mode: "planning_only", detail: "No-op." },
              },
            ],
          },
          meta: {
            source: "first_party_multi_action_upgrade_v2",
            evaluatedAt: "2026-03-10T00:00:07.000Z",
            dataStatus: "no_major_upgrade_actions_available",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Step 4: Review And Publish Improvements" })).toBeVisible();
    await expect(page.getByText("No major upgrade actions available.")).toBeVisible();
    await expect(page.getByText("Failed to evaluate multi-action upgrade system.")).toHaveCount(0);
  });
});
