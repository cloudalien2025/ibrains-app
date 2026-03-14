import { expect, test, type Page } from "@playwright/test";

const listingId = "654";

const listingResponse = {
  listing: {
    listing_id: listingId,
    listing_name: "Acme Plumbing",
    listing_url: "https://example.com/listings/acme-plumbing",
    mainImageUrl: null,
  },
  evaluation: {
    totalScore: 81,
  },
};

async function mockListingApis(page: Page): Promise<{ pushCalls: () => number }> {
  let pushRequestCount = 0;

  await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
  });

  await page.route("**/api/directoryiq/integrations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ openaiConfigured: true, bdConfigured: true }),
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
            inboundLinkedSupportCount: 1,
            mentionWithoutLinkCount: 2,
            outboundSupportLinkCount: 1,
            connectedSupportPageCount: 2,
            lastGraphRunAt: "2026-03-14T00:00:00.000Z",
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [
            {
              sourceId: "blog-1",
              sourceType: "blog_post",
              title: "Emergency plumbing checklist",
              url: "https://example.com/blog/emergency-checklist",
              relationshipType: "mentions_without_link",
            },
          ],
          outboundSupportLinks: [],
          connectedSupportPages: [
            { id: "support-1", type: "support", title: "Drain cleaning guide", url: "https://example.com/support/drains" },
          ],
        },
        meta: {
          source: "first_party_graph_v1",
          evaluatedAt: "2026-03-14T00:00:01.000Z",
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
            totalGaps: 2,
            highCount: 1,
            mediumCount: 1,
            lowCount: 0,
            evaluatedAt: "2026-03-14T00:00:01.000Z",
            lastGraphRunAt: "2026-03-14T00:00:00.000Z",
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
          ],
        },
        meta: {
          source: "first_party_authority_gaps_v1",
          evaluatedAt: "2026-03-14T00:00:01.000Z",
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
            evaluatedAt: "2026-03-14T00:00:02.000Z",
            dataStatus: "actions_recommended",
          },
          items: [
            {
              key: "add_flywheel_links",
              priority: "high",
              title: "Add flywheel links",
              rationale: "Connect support posts with direct links.",
              evidenceSummary: "Mentions without links: 2.",
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
      body: JSON.stringify({ ok: true, intentClusters: { listing: { id: listingId, title: "Acme Plumbing" }, summary: { totalClusters: 0, highPriorityCount: 0, mediumPriorityCount: 0, lowPriorityCount: 0, evaluatedAt: "2026-03-14T00:00:02.000Z", dataStatus: "no_major_reinforcement_intent_clusters_identified" }, items: [] } }),
    });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/reinforcement-plan**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, reinforcementPlan: { listing: { id: listingId, title: "Acme Plumbing" }, summary: { totalPlanItems: 0, highPriorityCount: 0, mediumPriorityCount: 0, lowPriorityCount: 0, evaluatedAt: "2026-03-14T00:00:03.000Z", dataStatus: "no_major_reinforcement_plan_items_identified" }, items: [] } }),
    });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/content-structure**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, contentStructure: { listing: { id: listingId, title: "Acme Plumbing" }, summary: { totalRecommendations: 0, highPriorityCount: 0, mediumPriorityCount: 0, lowPriorityCount: 0, evaluatedAt: "2026-03-14T00:00:03.000Z", dataStatus: "no_major_structure_recommendations_identified", serpPatternStatus: "patterns_unavailable", serpPatternSource: "none" }, items: [] } }),
    });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/multi-action**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        multiAction: {
          listing: { id: listingId, title: "Acme Plumbing" },
          summary: {
            totalActions: 2,
            availableCount: 2,
            blockedCount: 0,
            notRecommendedCount: 0,
            highPriorityCount: 1,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-14T00:00:04.000Z",
            dataStatus: "upgrade_actions_available",
          },
          grouped: {
            byReadiness: { ready: ["repair-1", "copy-1"], blocked: [], abstained: [] },
            bySurface: { listing: ["repair-1", "copy-1"], blog: [], support_page: [], cluster: [] },
          },
          items: [
            {
              actionId: "repair-1",
              actionType: "internal_link_trust_signal",
              key: "repair_flywheel_links",
              title: "Repair internal support links",
              description: "Add direct links between support pages and the listing.",
              whyItMatters: "Direct links help authority flow and AI selection confidence.",
              sourceSignals: {},
              expectedImpact: "Higher authority consistency across support assets.",
              dependencies: [],
              recommendedPriority: "high",
              readinessState: "ready",
              priority: "high",
              status: "available",
              rationale: "Link graph indicates repair opportunities.",
              evidenceSummary: "Two support pages mention without linking.",
              targetSurface: "listing",
            },
            {
              actionId: "copy-1",
              actionType: "listing_detail_improvement",
              key: "optimize_listing_description",
              title: "Optimize listing description",
              description: "Tighten the listing headline and proof block.",
              whyItMatters: "Improves clarity and conversion confidence.",
              sourceSignals: {},
              expectedImpact: "Stronger listing conversion language.",
              dependencies: [],
              recommendedPriority: "medium",
              readinessState: "ready",
              priority: "medium",
              status: "available",
              rationale: "Content signals indicate outdated copy.",
              evidenceSummary: "Current copy misses trust proof.",
              targetSurface: "listing",
              previewCapability: {
                supported: true,
                generateEndpoint: "/api/directoryiq/listings/:listingId/upgrade/generate",
                previewEndpoint: "/api/directoryiq/listings/:listingId/upgrade/preview",
                pushEndpoint: "/api/directoryiq/listings/:listingId/upgrade/push",
                requiresApprovalToken: true,
                requiresBdForPush: true,
              },
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
            totalRecommendations: 2,
            highPriorityCount: 1,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-14T00:00:05.000Z",
            dataStatus: "flywheel_opportunities_found",
          },
          items: [
            {
              key: "rec-one",
              type: "blog_posts_should_link_to_listing",
              priority: "high",
              title: "Emergency checklist should link to the listing",
              rationale: "The support post mentions the listing without a direct link.",
              evidenceSummary: "Detected mention without direct link.",
              sourceEntity: {
                id: "blog-1",
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
              anchorGuidance: {
                suggestedAnchorText: "Acme Plumbing emergency service",
                guidance: "Place this anchor in the section discussing after-hours repairs.",
              },
            },
            {
              key: "rec-two",
              type: "missing_reciprocal_link",
              priority: "medium",
              title: "Listing page should link back to drain cleaning guide",
              rationale: "Reciprocal links strengthen trust and crawl paths.",
              evidenceSummary: "Listing does not link back to an existing guide.",
              sourceEntity: {
                id: listingId,
                type: "listing",
                title: "Acme Plumbing",
                url: "https://example.com/listings/acme-plumbing",
              },
              targetEntity: {
                id: "guide-1",
                type: "guide_page",
                title: "Drain cleaning guide",
                url: "https://example.com/support/drains",
              },
              anchorGuidance: {
                suggestedAnchorText: "Drain cleaning guide",
                guidance: "Add this near the service details section on the listing page.",
              },
            },
          ],
        },
      }),
    });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/push**`, async (route) => {
    pushRequestCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/generate**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ draftId: "draft-1", proposedDescription: "Updated copy" }) });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}/upgrade/preview**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ diff: [], approvalToken: "token-1" }) });
  });

  return { pushCalls: () => pushRequestCount };
}

test.describe("DirectoryIQ link operations workflow", () => {
  test("opens recommendation-specific operations, supports edit/approve/queue, and surfaces in Step 5", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const telemetry = await mockListingApis(page);

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Acme Plumbing" })).toBeVisible();

    await page.getByTestId("listing-step-nav-mobile-connect-existing-pages").click();
    await expect(page.getByRole("heading", { name: "Step 2: Connect existing pages" })).toBeVisible();

    await page.getByTestId("open-link-operations-flywheel-rec-one").click();

    const panel = page.getByTestId("link-operations-workflow-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Emergency checklist should link to the listing")).toBeVisible();
    await expect(panel.getByText("Emergency plumbing checklist to Acme Plumbing")).toBeVisible();

    const anchorInput = panel.getByRole("textbox").first();
    await anchorInput.fill("Emergency plumbing help from Acme Plumbing");
    await expect(anchorInput).toHaveValue("Emergency plumbing help from Acme Plumbing");

    await panel.getByRole("button", { name: "Approve" }).first().click();
    await expect(panel.getByText("Approved")).toBeVisible();

    await panel.getByRole("button", { name: "Queue for launch" }).first().click();
    await expect(panel.getByText("Queued for launch")).toBeVisible();

    await page.getByTestId("link-operations-close").click();
    await expect(page.getByTestId("link-operations-workflow-panel")).toHaveCount(0);

    await page.getByTestId("open-link-operations-flywheel-rec-two").click();
    await expect(page.getByTestId("link-operations-workflow-panel").getByText("Listing page should link back to drain cleaning guide")).toBeVisible();
    await expect(page.getByTestId("link-operations-workflow-panel").getByText("Emergency checklist should link to the listing")).toHaveCount(0);
    await page.getByTestId("link-operations-close").click();

    await page.getByTestId("listing-step-nav-mobile-launch-and-measure").click();
    await expect(page.getByRole("heading", { name: "Step 5: Launch and measure" })).toBeVisible();
    await expect(page.getByText("Ready to launch: 1 link operation.")).toBeVisible();
    await expect(page.getByText("Review items: 0 approved internal link updates.")).toBeVisible();
    await expect(page.getByTestId("step5-ready-to-launch-count")).toContainText("3");
    await expect(page.getByText("Emergency checklist should link to the listing")).toBeVisible();

    expect(telemetry.pushCalls()).toBe(0);
  });

  test("opens on desktop when link workflow is requested from a recommendation", async ({ page }) => {
    await mockListingApis(page);

    await page.goto(`/directoryiq/listings/${listingId}?step=connect-existing-pages`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Step 2: Connect existing pages" })).toBeVisible();
    await page.getByTestId("open-link-operations-flywheel-rec-one").click();

    await expect(page.getByTestId("link-operations-workflow-panel")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Link Operations Workflow" })).toBeVisible();

    await page.getByTestId("link-operations-close").click();
    await expect(page.getByTestId("link-operations-workflow-overlay")).toHaveCount(0);
  });
});
