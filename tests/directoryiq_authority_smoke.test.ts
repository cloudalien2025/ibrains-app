import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "smoke-key");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "site-1:321",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: { description: "Sample listing description" },
  },
  evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
  settings: { imageStylePreference: "editorial clean" },
}));
const findListingCandidates = vi.fn(async () => [
  { sourceId: "site-1:321", siteId: "site-1", siteLabel: "Site One" },
]);
const upsertAuthorityPostDraft = vi.fn(async () => {});
const saveAuthorityImage = vi.fn(async () => {});
const generateAuthorityDraft = vi.fn(async () => "<p>Draft html</p>");
const generateAuthorityImage = vi.fn(async () => "data:image/png;base64,smoke");
const validateOpenAiKeyPresent = vi.fn((value: string | null) => value || "smoke-key");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));
vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
}));
vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally: vi.fn(() => true),
}));
vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  findListingCandidates,
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

describe("directoryiq authority smoke generation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates draft and image for fixture listing 321", async () => {
    const draftRoute = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const imageRoute = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");

    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Smoke Draft",
        focus_topic: "smoke topic",
        type: "contextual_guide",
      }),
    });

    const imageReq = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        focus_topic: "smoke topic",
      }),
    });

    const draftRes = await draftRoute.POST(draftReq, { params: { listingId: "321", slot: "1" } });
    const imageRes = await imageRoute.POST(imageReq, { params: { listingId: "321", slot: "1" } });

    expect(draftRes.status).toBe(200);
    expect(imageRes.status).toBe(200);
  });
});
