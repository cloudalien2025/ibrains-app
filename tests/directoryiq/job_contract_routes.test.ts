import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireDirectoryIqWriteUser = vi.fn(async () => "00000000-0000-4000-8000-000000000001");
const createDirectoryIqJob = vi.fn(async () => ({
  id: "djq_req_123",
  reqId: "req_123",
  userId: "00000000-0000-4000-8000-000000000001",
  kind: "step2.draft",
  status: "queued",
  stage: "queued",
  listingId: "321",
  siteId: "site-1",
  slot: 1,
  acceptedAt: "2026-03-22T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
}));
const runDirectoryIqJob = vi.fn(() => {});
const getDirectoryIqJobForUser = vi.fn(async () => ({
  id: "djq_req_123",
  reqId: "req_123",
  userId: "00000000-0000-4000-8000-000000000001",
  kind: "step3.generate",
  status: "running",
  stage: "generating",
  listingId: "site-1:321",
  siteId: "site-1",
  slot: null,
  acceptedAt: "2026-03-22T00:00:00.000Z",
  startedAt: "2026-03-22T00:00:01.000Z",
  finishedAt: null,
  result: null,
  error: null,
}));

vi.mock("@/app/api/directoryiq/_utils/writeAuth", () => ({
  requireDirectoryIqWriteUser,
}));

vi.mock("@/app/api/directoryiq/_utils/jobs", () => ({
  createDirectoryIqJob,
  runDirectoryIqJob,
  getDirectoryIqJobForUser,
}));

vi.mock("@/app/api/directoryiq/_utils/authorityErrors", () => ({
  AuthorityRouteError: class AuthorityRouteError extends Error {
    status: number;
    code: string;
    details?: string;
    constructor(status: number, code: string, message: string, details?: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
  authorityReqId: () => "req_123",
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey: vi.fn(async () => "test-key"),
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation: vi.fn(async () => ({
    listingEval: {
      listing: {
        source_id: "site-1:321",
        title: "Fixture",
        url: "https://example.com/listing",
        raw_json: { description: "d" },
      },
      settings: { imageStylePreference: "clean" },
    },
  })),
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  upsertAuthorityPostDraft: vi.fn(async () => {}),
  saveAuthorityImage: vi.fn(async () => {}),
}));

vi.mock("@/app/api/directoryiq/_utils/authority", () => ({
  normalizePostType: (value: string) => (value || "local_guide"),
  normalizeSlot: (value: string) => Number(value),
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  ensureContextualListingLink: vi.fn(({ html }: { html: string }) => html),
  validateDraftHtml: vi.fn(() => ({ valid: true, errors: [], hasContextualListingLink: true })),
  buildImagePrompt: vi.fn(() => "image-prompt"),
}));

vi.mock("@/lib/openai/serverClient", () => ({
  validateOpenAiKeyPresent: (value: string) => value,
  generateAuthorityDraft: vi.fn(async () => "<p>ok</p>"),
  generateAuthorityImage: vi.fn(async () => "https://example.com/image.jpg"),
}));

vi.mock("@/src/directoryiq/services/upgradeService", () => ({
  generateUpgrade: vi.fn(async () => ({
    draft: { id: "draft-1", proposedText: "Improved" },
    reqId: "req-generate",
  })),
}));

describe("directoryiq job route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("step2 draft submit returns accepted job contract and uses canonical write auth", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "local_guide", focus_topic: "topic" }),
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(requireDirectoryIqWriteUser).toHaveBeenCalledTimes(1);
    expect(createDirectoryIqJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "step2.draft",
        listingId: "321",
        siteId: "site-1",
        slot: 1,
      })
    );
    expect(json).toMatchObject({
      jobId: "djq_req_123",
      reqId: "req_123",
      status: "queued",
      statusEndpoint: "/api/directoryiq/jobs/djq_req_123",
    });
  });

  it("step3 generate submit returns accepted job contract and uses canonical write auth", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/generate/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/generate?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(requireDirectoryIqWriteUser).toHaveBeenCalledTimes(1);
    expect(createDirectoryIqJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "step3.generate",
        listingId: "321",
        siteId: "site-1",
      })
    );
    expect(json).toMatchObject({
      jobId: "djq_req_123",
      reqId: "req_123",
      status: "queued",
      statusEndpoint: "/api/directoryiq/jobs/djq_req_123",
    });
  });

  it("job status route returns status contract for authenticated owner", async () => {
    const { GET } = await import("@/app/api/directoryiq/jobs/[jobId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/jobs/djq_req_123");
    const res = await GET(req, { params: { jobId: "djq_req_123" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(requireDirectoryIqWriteUser).toHaveBeenCalledTimes(1);
    expect(getDirectoryIqJobForUser).toHaveBeenCalledWith("djq_req_123", "00000000-0000-4000-8000-000000000001");
    expect(json).toMatchObject({
      jobId: "djq_req_123",
      status: "running",
      stage: "generating",
      reqId: "req_123",
      listingId: "site-1:321",
      site_id: "site-1",
    });
  });
});

