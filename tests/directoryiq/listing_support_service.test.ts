import { beforeEach, describe, expect, it, vi } from "vitest";

const queryDb = vi.fn();
const getLatestRun = vi.fn();

vi.mock("@/src/directoryiq/repositories/db", () => ({
  queryDb: (...args: unknown[]) => queryDb(...args),
}));

vi.mock("@/src/directoryiq/repositories/authorityGraphRepo", () => ({
  getLatestRun: (...args: unknown[]) => getLatestRun(...args),
}));

import { getListingCurrentSupport } from "@/src/directoryiq/services/listingSupportService";

describe("listing support service", () => {
  beforeEach(() => {
    queryDb.mockReset();
    getLatestRun.mockReset();
  });

  it("returns inbound links with anchors and mentions without links separately", async () => {
    getLatestRun.mockResolvedValue({
      id: "run-1",
      status: "completed",
      stats: {},
      startedAt: "2026-03-07T12:00:00Z",
      completedAt: "2026-03-07T12:30:00Z",
    });

    queryDb.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM authority_graph_nodes") && sql.includes("node_type = 'listing'")) {
        return [{ id: "listing-node", external_id: "listing-1", canonical_url: "https://example.com/listing-1", title: "Listing One" }];
      }
      if (sql.includes("FROM authority_graph_edges")) {
        return [
          {
            edge_id: "edge-1",
            edge_type: "internal_link",
            blog_node_id: "blog-1-node",
            blog_external_id: "blog-1",
            blog_title: "Blog One",
            blog_url: "https://example.com/blog-1",
            anchor_text: "Listing One",
            context_snippet: "Listing One highlights.",
            detected_at: "2026-03-07T10:00:00Z",
          },
          {
            edge_id: "edge-1",
            edge_type: "internal_link",
            blog_node_id: "blog-1-node",
            blog_external_id: "blog-1",
            blog_title: "Blog One",
            blog_url: "https://example.com/blog-1",
            anchor_text: "Top Listing One",
            context_snippet: "Listing One highlights.",
            detected_at: "2026-03-07T10:05:00Z",
          },
          {
            edge_id: "edge-2",
            edge_type: "mention_without_link",
            blog_node_id: "blog-1-node",
            blog_external_id: "blog-1",
            blog_title: "Blog One",
            blog_url: "https://example.com/blog-1",
            anchor_text: null,
            context_snippet: "Mentioned without link.",
            detected_at: "2026-03-07T11:00:00Z",
          },
          {
            edge_id: "edge-3",
            edge_type: "mention_without_link",
            blog_node_id: "blog-2-node",
            blog_external_id: "blog-2",
            blog_title: "Blog Two",
            blog_url: "https://example.com/blog-2",
            anchor_text: null,
            context_snippet: "Another mention.",
            detected_at: "2026-03-07T11:30:00Z",
          },
        ];
      }
      if (sql.includes("FROM directoryiq_listing_backlinks")) {
        return [];
      }
      if (sql.includes("FROM directoryiq_hub_members")) {
        return [];
      }
      return [];
    });

    const support = await getListingCurrentSupport({
      tenantId: "default",
      listingId: "listing-1",
      listingTitle: "Listing One",
      listingUrl: "https://example.com/listing-1",
    });

    expect(support.inboundLinkedSupport).toHaveLength(1);
    expect(support.inboundLinkedSupport[0].anchors).toEqual(["Listing One", "Top Listing One"]);
    expect(support.mentionsWithoutLinks).toHaveLength(1);
    expect(support.mentionsWithoutLinks[0].sourceId).toBe("blog-2");
    expect(support.summary.inboundLinkedSupportCount).toBe(1);
    expect(support.summary.mentionWithoutLinkCount).toBe(1);
  });

  it("returns deterministic zero-state when listing node is missing", async () => {
    getLatestRun.mockResolvedValue(null);
    queryDb.mockResolvedValue([]);

    const support = await getListingCurrentSupport({
      tenantId: "default",
      listingId: "listing-missing",
      listingTitle: "Missing Listing",
      listingUrl: null,
    });

    expect(support.summary.inboundLinkedSupportCount).toBe(0);
    expect(support.summary.mentionWithoutLinkCount).toBe(0);
    expect(support.summary.outboundSupportLinkCount).toBe(0);
    expect(support.summary.connectedSupportPageCount).toBe(0);
    expect(support.inboundLinkedSupport).toHaveLength(0);
    expect(support.mentionsWithoutLinks).toHaveLength(0);
    expect(support.outboundSupportLinks).toHaveLength(0);
    expect(support.connectedSupportPages).toHaveLength(0);
  });

  it("rolls up outbound and connected support counts", async () => {
    getLatestRun.mockResolvedValue({ id: "run-2", status: "completed", stats: {}, startedAt: "2026-03-08T01:00:00Z", completedAt: null });

    queryDb.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM authority_graph_nodes") && sql.includes("node_type = 'listing'")) {
        return [{ id: "listing-node", external_id: "listing-2", canonical_url: null, title: "Listing Two" }];
      }
      if (sql.includes("FROM authority_graph_edges")) {
        return [];
      }
      if (sql.includes("FROM directoryiq_listing_backlinks")) {
        return [
          { blog_node_id: "blog-9", blog_url: "https://example.com/blog-9", blog_title: "Blog Nine", blog_canonical_url: "https://example.com/blog-9" },
          { blog_node_id: null, blog_url: "https://example.com/guide", blog_title: null, blog_canonical_url: null },
        ];
      }
      if (sql.includes("FROM directoryiq_hub_members")) {
        return [{ hub_id: "hub-1", hub_title: "Plumbers · Austin", category_slug: "plumbers", geo_slug: "austin", topic_slug: "repair" }];
      }
      return [];
    });

    const support = await getListingCurrentSupport({
      tenantId: "default",
      listingId: "listing-2",
      listingTitle: "Listing Two",
      listingUrl: null,
    });

    expect(support.outboundSupportLinks).toHaveLength(2);
    expect(support.connectedSupportPages).toHaveLength(1);
    expect(support.summary.outboundSupportLinkCount).toBe(2);
    expect(support.summary.connectedSupportPageCount).toBe(1);
  });
});
