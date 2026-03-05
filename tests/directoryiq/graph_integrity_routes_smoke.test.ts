import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "user-1");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

const computeTenantSummary = vi.fn(async () => ({
  orphan_listings_count: 1,
  leaks_count: 2,
  missing_backlinks_count: 3,
  avg_anchor_diversity: 50,
  last_computed_at: null,
}));
const listListingBacklinkCandidates = vi.fn(async () => []);
const listAuthorityLeaks = vi.fn(async () => []);

vi.mock("@/src/directoryiq/services/graphIntegrity/integrityMetrics", () => ({
  computeTenantSummary,
  listListingBacklinkCandidates,
  listAuthorityLeaks,
}));

const rebuildGraphIntegrity = vi.fn(async () => ({ updatedListings: 1, updatedBlogs: 1, warnings: [] }));
vi.mock("@/src/directoryiq/services/graphIntegrity/integrityRunner", () => ({
  rebuildGraphIntegrity,
}));

describe("graph integrity routes", () => {
  it("summary returns JSON", async () => {
    const { GET } = await import("@/app/api/directoryiq/graph-integrity/summary/route");
    const req = new NextRequest("http://localhost/api/directoryiq/graph-integrity/summary?tenantId=default", {
      headers: { "x-user-features": "directoryiq_graph_integrity_v2" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.summary.orphan_listings_count).toBe(1);
  });

  it("rebuild returns JSON", async () => {
    const { POST } = await import("@/app/api/directoryiq/graph-integrity/rebuild/route");
    const req = new NextRequest("http://localhost/api/directoryiq/graph-integrity/rebuild", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-features": "directoryiq_graph_integrity_v2" },
      body: JSON.stringify({ tenantId: "default", mode: "dry_run" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.result.updatedListings).toBe(1);
  });
});
