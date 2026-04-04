import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  resolveBrainId: vi.fn(),
  proxyToBrains: vi.fn(),
  runAdapter: vi.fn(),
  runMultiSourceIngest: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/brains/resolveBrainId", () => ({
  resolveBrainId: mocks.resolveBrainId,
}));

vi.mock("@/app/api/_utils/proxy", () => ({
  proxyToBrains: mocks.proxyToBrains,
}));

vi.mock("@/lib/directoryiq/ingestion/adapters", () => ({
  runAdapter: mocks.runAdapter,
}));

vi.mock("@/lib/directoryiq/ingestion/engine", () => ({
  runMultiSourceIngest: mocks.runMultiSourceIngest,
}));

describe("POST /api/brains/[id]/ingest youtube mode routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ unauthorizedResponse: null });
    mocks.resolveBrainId.mockImplementation((id: string) => id);
  });

  it("uses worker proxy contract for keyword discovery payloads", async () => {
    const { POST } = await import("@/app/api/brains/[id]/ingest/route");
    const proxied = Response.json({ run_id: "run_worker_1" }, { status: 202 });
    mocks.proxyToBrains.mockResolvedValueOnce(proxied);

    const req = new NextRequest("http://localhost/api/brains/directoryiq/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        keyword: "brilliant directories",
        selected_new: 5,
        youtube_requested_new: 5,
        youtube_max_candidates: 5,
      }),
    });

    const res = await POST(req, { params: { id: "directoryiq" } });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.run_id).toBe("run_worker_1");
    expect(mocks.proxyToBrains).toHaveBeenCalledTimes(1);
    expect(mocks.proxyToBrains).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "/v1/brains/directoryiq/ingest",
      { requireAuth: true }
    );
    expect(mocks.runAdapter).not.toHaveBeenCalled();
    expect(mocks.runMultiSourceIngest).not.toHaveBeenCalled();
  });

  it("keeps direct YouTube URL payloads on adapter ingest path", async () => {
    const { POST } = await import("@/app/api/brains/[id]/ingest/route");
    mocks.runAdapter.mockResolvedValueOnce([
      {
        source_type: "youtube",
        source_key: "abc123_XYZ",
        source_locator: "https://www.youtube.com/watch?v=abc123_XYZ",
        title: "Example",
        content: "Transcript",
        metadata: {},
        content_hash: "hash",
        last_seen_at: "2026-04-04T00:00:00.000Z",
      },
    ]);
    mocks.runMultiSourceIngest.mockResolvedValueOnce({
      brain_id: "directoryiq",
      source_type: "youtube",
      candidates_found: 1,
      new_items_added: 1,
      duplicates_skipped: 0,
      updated_items: 0,
      versioned_items: 0,
      eligible_for_processing: 1,
      failed_items: 0,
      source_totals: {
        web_search: 0,
        website_url: 0,
        document_upload: 0,
        youtube: 1,
      },
    });

    const req = new NextRequest("http://localhost/api/brains/directoryiq/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_type: "youtube",
        url: "https://www.youtube.com/watch?v=abc123_XYZ",
      }),
    });

    const res = await POST(req, { params: { id: "directoryiq" } });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.proxyToBrains).not.toHaveBeenCalled();
    expect(mocks.runAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "youtube",
        payload: expect.objectContaining({
          source_type: "youtube",
          url: "https://www.youtube.com/watch?v=abc123_XYZ",
        }),
      })
    );
    expect(mocks.runMultiSourceIngest).toHaveBeenCalledTimes(1);
    expect(payload.counters).toMatchObject({
      candidates_found: 1,
      new_items_added: 1,
      duplicates_skipped: 0,
      updated_items: 0,
      versioned_items: 0,
      eligible_for_processing: 1,
    });
  });
});
