import { describe, expect, it, vi, beforeEach } from "vitest";

const queryDb = vi.fn();

vi.mock("@/src/directoryiq/repositories/db", () => ({
  queryDb: (...args: unknown[]) => queryDb(...args),
}));

import { computeListingMetrics, computeBlogMetrics } from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";

describe("graph integrity metrics", () => {
  beforeEach(() => {
    queryDb.mockReset();
  });

  it("computes listing metrics with anchor diversity and backlink compliance", async () => {
    queryDb.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM authority_graph_nodes") && sql.includes("node_type = 'listing'")) {
        return [{ id: "listing-node", external_id: "listing-1", canonical_url: null, title: "Listing 1" }];
      }
      if (sql.includes("FROM authority_graph_edges") && sql.includes("inbound_links_to_count")) {
        return [{ inbound_links_to_count: 2, inbound_mentions_count: 1, unique_referring_blogs: 2 }];
      }
      if (sql.includes("FROM authority_graph_edges") && sql.includes("authority_graph_evidence")) {
        return [
          { blog_url: "https://example.com/blog/1", anchor_text: "Acme Plumbing" },
          { blog_url: "https://example.com/blog/2", anchor_text: "Acme Plumbing Austin" },
        ];
      }
      if (sql.includes("FROM directoryiq_anchor_ledger") && sql.includes("anchor_hash")) {
        return [{ anchor_hash: "a" }, { anchor_hash: "b" }];
      }
      if (sql.includes("FROM directoryiq_listing_backlinks")) {
        return [{ present_count: 1, total_count: 2 }];
      }
      return [];
    });

    const metrics = await computeListingMetrics({ tenantId: "default", listingId: "listing-1" });
    expect(metrics?.inbound_links_to_count).toBe(2);
    expect(metrics?.inbound_mentions_count).toBe(1);
    expect(metrics?.anchor_diversity_score).toBe(100);
    expect(metrics?.backlink_compliance_rate).toBe(50);
    expect(metrics?.orphan_status).toBe(false);
  });

  it("computes blog metrics with policy compliance reasons", async () => {
    queryDb.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM authority_graph_nodes") && sql.includes("node_type = 'blog_post'")) {
        return [{ id: "blog-node", external_id: "blog-1", canonical_url: "https://example.com/blog/1", title: "Blog" }];
      }
      if (sql.includes("FROM authority_graph_edges") && sql.includes("linked_listings")) {
        return [{ linked_listings: 1, unlinked_mentions: 2, extracted_entities: 3 }];
      }
      if (sql.includes("authority_graph_evidence")) {
        return [{ anchor_text: "click here" }];
      }
      return [];
    });

    const metrics = await computeBlogMetrics({ tenantId: "default", blogIdOrSlug: "blog-1" });
    expect(metrics?.linked_listings).toBe(1);
    expect(metrics?.unlinked_mentions).toBe(2);
    expect(metrics?.link_policy_compliance.ok).toBe(false);
    expect(metrics?.link_policy_compliance.reasons).toContain("banned_anchor");
  });
});
