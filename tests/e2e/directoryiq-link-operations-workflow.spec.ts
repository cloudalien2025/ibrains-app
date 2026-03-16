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

async function mockListingApis(page: Page): Promise<void> {
  await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
  });

  await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
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
          mentionsWithoutLinks: [],
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
            },
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
          listing: { id: listingId, title: "Acme Plumbing" },
          summary: {
            totalPlanItems: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-14T00:00:03.000Z",
            dataStatus: "plan_items_identified",
          },
          items: [
            {
              id: "publish_comparison_decision_post",
              title: "Publish a reinforcement blog post with reciprocal linking",
              priority: "high",
              rationale: "Needs support content.",
              evidenceSummary: "Gap data present.",
              suggestedContentPurpose: "Strengthen authority.",
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
          listing: { id: listingId, title: "Acme Plumbing" },
          summary: {
            totalRecommendations: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-14T00:00:03.000Z",
            dataStatus: "structure_recommendations_identified",
            serpPatternStatus: "patterns_available",
            serpPatternSource: "serp_cache",
          },
          items: [
            {
              id: "structure_decision_comparison",
              title: "Decision comparison structure",
              priority: "high",
              recommendedTitlePattern: "Best [service] in [city]",
              suggestedH1: "Best plumbing options in Austin",
              suggestedSections: ["FAQ"],
              faqThemes: ["pricing", "availability"],
              localModifiers: ["Austin"],
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
          listing: { id: listingId, title: "Acme Plumbing" },
          summary: {
            totalActions: 1,
            availableCount: 1,
            blockedCount: 0,
            notRecommendedCount: 0,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-14T00:00:04.000Z",
            dataStatus: "upgrade_actions_available",
          },
          items: [
            {
              actionId: "copy-1",
              key: "optimize_listing_description",
              title: "Optimize listing description",
              description: "Tighten listing copy",
              whyItMatters: "Improves clarity",
              expectedImpact: "Better conversion",
              dependencies: [],
              recommendedPriority: "high",
              readinessState: "ready",
              status: "available",
              rationale: "Signals indicate outdated copy",
              evidenceSummary: "Trust proof missing",
              targetSurface: "listing",
              previewCapability: { supported: true },
            },
          ],
        },
      }),
    });
  });
}

test.describe("DirectoryIQ link operations workflow", () => {
  test("supports mission plan selection in Step 1 and surfaces persistent publish layer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockListingApis(page);
    const listingApiMutations: string[] = [];
    page.on("request", (request) => {
      const isListingApi = request.url().includes(`/api/directoryiq/listings/${listingId}/`);
      if (isListingApi && request.method() !== "GET") {
        listingApiMutations.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("authority-map-zone")).toBeVisible();
    await expect(page.getByTestId("listing-step-nav-desktop-make-connections")).toBeVisible();

    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();
    await expect(page.getByTestId("step1-real-existing-connections")).toBeVisible();
    await expect(page.getByTestId("step1-real-mentions-without-links")).toBeVisible();
    await expect(page.getByTestId("step1-derived-recommendations")).toBeVisible();
    await expect(page.getByTestId("step1-missing-connections")).toBeVisible();

    const derivedSection = page.getByTestId("step1-derived-recommendations");
    await expect(page.getByText("Emergency checklist should link to the listing")).toBeVisible();
    await expect(derivedSection.getByText("Source: Blog post • ID: blog-1")).toBeVisible();
    await expect(derivedSection.getByText("Type: Blog post").first()).toBeVisible();
    await expect(derivedSection.getByText("Type: Listing").first()).toBeVisible();
    await expect(derivedSection.getByText("ID: 654").first()).toBeVisible();
    await expect(derivedSection.getByText("https://example.com/blog/emergency-checklist").first()).toBeVisible();
    await expect(derivedSection.getByText("https://example.com/listings/acme-plumbing").first()).toBeVisible();
    await expect(derivedSection.getByText("Planning state only. This does not publish to Brilliant Directories.").first()).toBeVisible();
    await expect(page.getByTestId("step1-derived-recommendations").getByRole("button", { name: "Publish to Site" })).toHaveCount(0);
    await expect(derivedSection.getByRole("button", { name: "Mark Ready" })).toHaveCount(0);
    await expect(derivedSection.getByRole("button", { name: "Queue for Publish" })).toHaveCount(0);
    await expect(derivedSection.getByLabel("Add to Mission Plan").first()).toBeVisible();

    const postMutationCount = listingApiMutations.length;
    await derivedSection.getByLabel("Add to Mission Plan").first().check();
    await expect(derivedSection.getByLabel("In Mission Plan").first()).toBeChecked();
    await expect(page.getByText("In Mission Plan").first()).toBeVisible();

    await derivedSection.getByLabel("In Mission Plan").first().uncheck();
    await expect(derivedSection.getByLabel("Add to Mission Plan").first()).not.toBeChecked();
    const postClickMutations = listingApiMutations.slice(postMutationCount);
    expect(postClickMutations.some((entry) => /\/(publish|push|authority)\b/.test(entry))).toBe(false);

    await expect(page.getByTestId("publish-execution-layer")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ready to Publish" })).toBeVisible();
  });

  test("keeps publish execution layer visible while switching steps", async ({ page }) => {
    await mockListingApis(page);

    await page.goto(`/directoryiq/listings/${listingId}?step=generate-content`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-generate-content").click();
    await expect(page.getByRole("heading", { name: "Step 2: Generate Content" })).toBeVisible();
    await expect(page.getByTestId("publish-execution-layer")).toBeVisible();

    await page.getByTestId("listing-step-nav-desktop-optimize-listing").click();
    await expect(page.getByRole("heading", { name: "Step 3: Optimize Listing" })).toBeVisible();
    await expect(page.getByTestId("publish-execution-layer")).toBeVisible();
  });

  test("keeps Step 1 recommendation cards mobile-safe for long Source/Target text", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockListingApis(page);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/flywheel-links**`);
    const longSourceTitle = ("Source title " + "extended context words ".repeat(16)).trim();
    const longTargetTitle = ("Target title " + "expanded destination words ".repeat(16)).trim();
    const longSourceId = `source-${"a".repeat(120)}`;
    const longTargetId = `target-${"b".repeat(120)}`;
    const longSourceUrl = `https://example.com/blog/${"long-source-segment-".repeat(10)}final`;
    const longTargetUrl = `https://example.com/listings/${"long-target-segment-".repeat(10)}final`;

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
              evaluatedAt: "2026-03-14T00:00:05.000Z",
              dataStatus: "flywheel_opportunities_found",
            },
            items: [
              {
                key: "rec-long-mobile",
                type: "blog_posts_should_link_to_listing",
                priority: "high",
                title: "Long content should remain inside the card",
                rationale: "Ensure long source and target identity details wrap safely.",
                evidenceSummary: "Mobile-safe wrapping check.",
                sourceEntity: {
                  id: longSourceId,
                  type: "blog_post",
                  title: longSourceTitle,
                  url: longSourceUrl,
                },
                targetEntity: {
                  id: longTargetId,
                  type: "listing",
                  title: longTargetTitle,
                  url: longTargetUrl,
                },
              },
            ],
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible();

    const derivedSection = page.getByTestId("step1-derived-recommendations");
    const firstCard = page.getByTestId("step1-recommendation-card").first();
    await expect(derivedSection).toBeVisible();
    await expect(firstCard).toContainText(longSourceTitle);
    await expect(firstCard).toContainText(longTargetTitle);
    await expect(firstCard).toContainText(longSourceUrl);
    await expect(firstCard).toContainText(longTargetUrl);

    const overflow = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const root = document.documentElement;
      const body = document.body;
      const pageScrollWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="step1-recommendation-card"]'));
      const cardsOverflowViewport = cards.some((card) => card.getBoundingClientRect().right > viewportWidth + 1);
      const cardsInternalOverflow = cards.some((card) => card.scrollWidth > card.clientWidth + 1);
      return {
        hasPageOverflow: pageScrollWidth > viewportWidth + 1,
        cardsOverflowViewport,
        cardsInternalOverflow,
      };
    });

    expect(overflow.cardsOverflowViewport).toBe(false);
    expect(overflow.cardsInternalOverflow).toBe(false);
    expect(overflow.hasPageOverflow).toBe(false);
  });
});
