import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "321",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: { description: "Current description." },
  },
  evaluation: {
    totalScore: 44,
    gapsByPillar: { structure: ["Add specific services"], clarity: ["Remove vague claims"] },
  },
}));
const createListingUpgradeDraft = vi.fn(async () => ({ id: "draft-1" }));
const getListingUpgradeDraft = vi.fn(async () => ({
  id: "draft-1",
  status: "previewed",
  original_description: "Current description.",
  proposed_description: "Improved description.",
}));
const markListingUpgradePreviewed = vi.fn(async () => {});
const markListingUpgradePushed = vi.fn(async () => {});
const addDirectoryIqVersion = vi.fn(async () => "version-1");

const validateOpenAiKeyPresent = vi.fn((value: string | null) => {
  if (!value) throw new Error("OpenAI API not configured. Go to DirectoryIQ -> Settings -> Integrations.");
  return value;
});
const generateListingUpgradeDraft = vi.fn(async () => "Improved description.");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
  getDirectoryIqBdConnection: vi.fn(async () => ({ baseUrl: "https://example.com", apiKey: "k" })),
  pushListingUpdateToBd: vi.fn(async () => ({ ok: true, status: 200, body: {} })),
  resolveTruePostIdForListing: vi.fn(async () => ({ truePostId: "123", mappingKey: "slug" })),
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  extractListingDescription: vi.fn(() => "Current description."),
  createListingUpgradeDraft,
  getListingUpgradeDraft,
  markListingUpgradePreviewed,
  markListingUpgradePushed,
  addDirectoryIqVersion,
}));

vi.mock("@/lib/openai/serverClient", () => ({
  validateOpenAiKeyPresent,
  generateListingUpgradeDraft,
}));

describe("directoryiq listing upgrade routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generate route returns draft payload", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/generate/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/generate", {
      method: "POST",
      body: JSON.stringify({ mode: "standard" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ listingId: "321" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.draftId).toBe("draft-1");
    expect(generateListingUpgradeDraft).toHaveBeenCalledTimes(1);
  });

  it("generate route returns OPENAI_KEY_MISSING when key absent", async () => {
    getDirectoryIqOpenAiKey.mockResolvedValueOnce(null as unknown as string);
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/generate/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/generate", {
      method: "POST",
      body: JSON.stringify({ mode: "standard" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ listingId: "321" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("OPENAI_KEY_MISSING");
    expect(typeof json.error.reqId).toBe("string");
  });

  it("push route requires explicit preview token + approval", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/push/route");
    const token = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "321",
      action: "listing_push",
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/push", {
      method: "POST",
      body: JSON.stringify({ draftId: "draft-1", approved: true, approvalToken: token }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321" }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(markListingUpgradePushed).toHaveBeenCalledTimes(1);
  });
});
