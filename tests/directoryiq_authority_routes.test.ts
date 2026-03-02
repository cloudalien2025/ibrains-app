import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthorityRouteError } from "@/app/api/directoryiq/_utils/authorityErrors";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getSerpApiKeyForUser = vi.fn(async () => null);
const getDirectoryIqBdConnection = vi.fn(async () => ({ baseUrl: "https://example.com" }));
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "321",
    title: "Fixture Listing",
    url: null,
    raw_json: { description: "Sample listing description", group_filename: "listings/fixture-listing" },
  },
  authorityPosts: [{ slot_index: 1, post_type: "comparison", focus_topic: "existing focus", title: "Existing title" }],
  evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
  settings: { imageStylePreference: "editorial clean" },
}));
const upsertAuthorityPostDraft = vi.fn(async () => {});
const saveAuthorityImage = vi.fn(async () => {});
const generateAuthorityDraft = vi.fn(async () => "<p>Draft html</p>");
const generateAuthorityImage = vi.fn(async () => "data:image/png;base64,abc123");
const validateOpenAiKeyPresent = vi.fn((value: string | null) => {
  if (!value) throw new AuthorityRouteError(400, "OPENAI_KEY_MISSING", "Missing key");
  return value;
});

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
  getSerpApiKeyForUser,
  getDirectoryIqBdConnection,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  upsertAuthorityPostDraft,
  saveAuthorityImage,
}));

vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft,
  generateAuthorityImage,
  validateOpenAiKeyPresent,
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  validateDraftHtml: vi.fn(() => ({ valid: true, hasContextualListingLink: true, errors: [] })),
  buildImagePrompt: vi.fn(() => "image prompt"),
}));

describe("directoryiq authority routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft for an authority slot", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Best in Miami",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
    expect(upsertAuthorityPostDraft).toHaveBeenCalledTimes(1);
  });

  it("falls back to listing/post defaults when draft payload omits title and focus topic", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      body: JSON.stringify({
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(upsertAuthorityPostDraft).toHaveBeenCalledTimes(1);
  });

  it("returns structured error when OpenAI key is missing", async () => {
    getDirectoryIqOpenAiKey.mockResolvedValueOnce(null as unknown as string);
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("OPENAI_KEY_MISSING");
    expect(typeof json.error.reqId).toBe("string");
    expect(saveAuthorityImage).not.toHaveBeenCalled();
  });

  it("falls back to listing/post defaults when image payload omits focus topic", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(saveAuthorityImage).toHaveBeenCalledTimes(1);
  });
});
