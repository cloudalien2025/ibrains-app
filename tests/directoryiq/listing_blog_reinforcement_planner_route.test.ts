import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq listing blog reinforcement planner route", () => {
  it("returns canonical reinforcement plan payload", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/reinforcement-plan/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/reinforcement-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            inboundLinkedSupportCount: 0,
            mentionWithoutLinkCount: 2,
            outboundSupportLinkCount: 0,
            connectedSupportPageCount: 0,
            lastGraphRunAt: null,
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [],
          outboundSupportLinks: [],
          connectedSupportPages: [],
        },
        gaps: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            totalGaps: 2,
            highCount: 1,
            mediumCount: 1,
            lowCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            lastGraphRunAt: null,
            dataStatus: "gaps_found",
          },
          items: [
            {
              type: "mentions_without_links",
              severity: "medium",
              title: "Mentions without links",
              explanation: "Mentions found.",
              evidenceSummary: "2 mention without link.",
            },
            {
              type: "missing_comparison_content",
              severity: "medium",
              title: "Missing comparison support",
              explanation: "Missing.",
              evidenceSummary: "No comparison slot found.",
            },
          ],
        },
        actions: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            totalActions: 2,
            highPriorityCount: 1,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
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
              key: "create_comparison_support_content",
              priority: "medium",
              title: "Create comparison support content",
              rationale: "Need comparison content.",
              evidenceSummary: "Missing comparison coverage.",
            },
          ],
        },
        flywheel: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            totalRecommendations: 1,
            highPriorityCount: 1,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
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
              targetEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme" },
            },
          ],
        },
        intentClusters: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            totalClusters: 2,
            highPriorityCount: 1,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            dataStatus: "clusters_identified",
          },
          items: [
            {
              id: "close_unlinked_support_mentions",
              title: "Close unlinked support mentions",
              priority: "high",
              rationale: "Mentions unlinked.",
              evidenceSummary: "Mentions without links: 2.",
            },
            {
              id: "reinforce_decision_stage_content",
              title: "Reinforce decision-stage support content",
              priority: "medium",
              rationale: "Need decision-stage support.",
              evidenceSummary: "Comparison/FAQ support missing.",
            },
          ],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reinforcementPlan.listing.id).toBe("321");
    expect(json.reinforcementPlan.summary.dataStatus).toBe("plan_items_identified");
    expect(json.reinforcementPlan.items[0].id).toBeDefined();
    expect(json.meta.source).toBe("first_party_blog_reinforcement_planner_v1");
  });

  it("accepts site-prefixed listing ids across all payloads", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/reinforcement-plan/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/reinforcement-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            inboundLinkedSupportCount: 1,
            mentionWithoutLinkCount: 0,
            outboundSupportLinkCount: 1,
            connectedSupportPageCount: 1,
            lastGraphRunAt: null,
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [],
          outboundSupportLinks: [],
          connectedSupportPages: [],
        },
        gaps: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            totalGaps: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            lastGraphRunAt: null,
            dataStatus: "no_meaningful_gaps",
          },
          items: [],
        },
        actions: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            totalActions: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            dataStatus: "no_major_actions_recommended",
          },
          items: [],
        },
        flywheel: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            totalRecommendations: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            dataStatus: "no_major_flywheel_opportunities",
          },
          items: [],
        },
        intentClusters: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            totalClusters: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            dataStatus: "no_major_reinforcement_intent_clusters_identified",
          },
          items: [],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reinforcementPlan.summary.dataStatus).toBe("no_major_reinforcement_plan_items_identified");
  });
});
