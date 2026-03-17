import { expect, test, type Page } from "@playwright/test";

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

async function expectMissionControlSteps(page: Page) {
  await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible();
  await expect(page.getByTestId("listing-step-nav-desktop-make-connections")).toBeVisible();
  await expect(page.getByTestId("listing-step-nav-desktop-generate-content")).toBeVisible();
  await expect(page.getByTestId("listing-step-nav-desktop-optimize-listing")).toBeVisible();
  await expect(page.getByTestId("listing-step-nav-desktop-launch-and-measure")).toHaveCount(0);
}

async function openStep3(page: Page) {
  await page.getByTestId("listing-step-nav-desktop-generate-content").click();
  await expect(page.getByRole("heading", { name: "Build Support Articles" })).toBeVisible();
}

test.describe("DirectoryIQ blog reinforcement plan contract", () => {
  test("renders deterministic plan and no-plan states", async ({ page }) => {
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
          totalGaps: 3,
          highCount: 1,
          mediumCount: 2,
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
            type: "missing_comparison_content",
            severity: "medium",
            title: "Missing comparison support",
            explanation: "Missing.",
            evidenceSummary: "No comparison slot found.",
          },
          {
            type: "missing_faq_support_coverage",
            severity: "medium",
            title: "Missing FAQ support",
            explanation: "Missing.",
            evidenceSummary: "No FAQ slot found.",
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
              totalActions: 3,
              highPriorityCount: 1,
              mediumPriorityCount: 2,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:02.000Z",
              dataStatus: "actions_recommended",
            },
            items: [
              { key: "add_flywheel_links", priority: "high", title: "Add flywheel links", rationale: "", evidenceSummary: "" },
              { key: "create_comparison_support_content", priority: "medium", title: "Comparison", rationale: "", evidenceSummary: "" },
              { key: "generate_reinforcement_post", priority: "medium", title: "Reinforcement post", rationale: "", evidenceSummary: "" },
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
              totalClusters: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:03.000Z",
              dataStatus: "clusters_identified",
            },
            items: [
              { id: "close_unlinked_support_mentions", title: "Close unlinked support mentions", priority: "high", rationale: "", evidenceSummary: "" },
              { id: "reinforce_decision_stage_content", title: "Reinforce decision-stage support content", priority: "medium", rationale: "", evidenceSummary: "" },
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
              totalPlanItems: 2,
              highPriorityCount: 1,
              mediumPriorityCount: 1,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:04.000Z",
              dataStatus: "plan_items_identified",
            },
            items: [
              {
                id: "publish_comparison_decision_post",
                title: "Publish a comparison decision-stage post",
                priority: "high",
                recommendationType: "comparison_page",
                targetIntent: "compare_alternatives",
                whyItMatters: "Comparison-stage users need alternatives context before selecting.",
                reinforcesListingId: listingId,
                expectedSelectionImpact: "High expected impact on listing selection confidence and conversion intent.",
                suggestedInternalLinkPattern:
                  "comparison-asset -> https://example.com/listings/acme-plumbing; listing -> comparison block -> comparison-asset",
                rankingContext: "Comparison Clarity (32/100, high urgency)",
                rationale: "Selection-stage users need comparison context.",
                evidenceSummary: "Comparison gap: yes.",
                suggestedContentPurpose: "Help users evaluate alternatives.",
                suggestedTargetSurface: "comparison",
              },
              {
                id: "publish_reciprocal_support_post",
                title: "Publish a reciprocal support post for inbound authority flow",
                priority: "medium",
                recommendationType: "blog_idea",
                targetIntent: "validate_trust_signals",
                whyItMatters: "Reciprocal links increase proof depth around the listing.",
                reinforcesListingId: listingId,
                expectedSelectionImpact: "Medium expected impact on listing selection confidence with stronger support coverage.",
                suggestedInternalLinkPattern:
                  "blog -> https://example.com/listings/acme-plumbing; listing -> related resources -> blog",
                rankingContext: "Proof Depth (40/100, high urgency)",
                rationale: "Unlinked mentions reduce authority transfer.",
                evidenceSummary: "Mentions without links: 2.",
                suggestedContentPurpose: "Create support post linking to listing and receiving reciprocal link.",
                suggestedTargetSurface: "blog",
              },
            ],
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expectMissionControlSteps(page);
    await openStep3(page);
    await expect(page.getByRole("button", { name: "Recommended Improvements" })).toHaveCount(0);
    await expect(page.getByText("Publish a comparison decision stage post")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Publish a reciprocal support post for inbound authority flow")).toBeVisible();
    await expect(page.getByText("No major reinforcement plan items identified.")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate blog reinforcement plan.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/reinforcement-plan**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/reinforcement-plan**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          reinforcementPlan: {
            listing: { id: listingId, title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme-plumbing", siteId: "site-1" },
            summary: {
              totalPlanItems: 0,
              highPriorityCount: 0,
              mediumPriorityCount: 0,
              lowPriorityCount: 0,
              evaluatedAt: "2026-03-10T00:00:04.000Z",
              dataStatus: "no_major_reinforcement_plan_items_identified",
            },
            items: [],
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expectMissionControlSteps(page);
    await openStep3(page);
    await expect(page.getByRole("button", { name: "Recommended Improvements" })).toHaveCount(0);
    await expect(page.getByText("Publish a comparison decision stage post")).toHaveCount(0);
    await expect(page.getByText("Publish a reciprocal support post for inbound authority flow")).toHaveCount(0);
    await expect(page.getByText("Failed to evaluate blog reinforcement plan.")).toHaveCount(0);
  });
});
