import { beforeEach, describe, expect, it, vi } from "vitest";
import { authoritySupportBaseUrl, loadAuthoritySupportInitialIssues } from "@/app/(brains)/directoryiq/authority-support/initial-issues";

describe("directoryiq authority-support initial issues contract", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses consistent default and host-derived base url", () => {
    expect(authoritySupportBaseUrl(null)).toBe("http://127.0.0.1:3001");
    expect(authoritySupportBaseUrl("example.test:3000")).toBe("http://example.test:3000");
  });

  it("returns normalized issues on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          issues: {
            orphans: [{ type: "orphan_listing" }],
            mentions_without_links: [{ type: "mention_without_link" }],
            weak_anchors: [{ type: "weak_anchor" }],
            lastRun: { id: "run-1", status: "completed", startedAt: "x", completedAt: "y", stats: {} },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAuthoritySupportInitialIssues("http://example.test");

    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/directoryiq/graph/issues", { cache: "no-store" });
    expect(result.error).toBeNull();
    expect(result.issues.orphans.length).toBe(1);
    expect(result.issues.mentions_without_links.length).toBe(1);
    expect(result.issues.weak_anchors.length).toBe(1);
    expect(result.issues.lastRun?.id).toBe("run-1");
  });

  it("returns empty issues and explicit error on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "issues unavailable" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAuthoritySupportInitialIssues("http://example.test");

    expect(result.error).toBe("issues unavailable");
    expect(result.issues.orphans).toEqual([]);
    expect(result.issues.mentions_without_links).toEqual([]);
    expect(result.issues.weak_anchors).toEqual([]);
    expect(result.issues.lastRun).toBeNull();
  });
});
