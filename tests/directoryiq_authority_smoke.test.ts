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
const getAuthorityPostBySlot = vi.fn(async () => ({
  metadata_json: null,
}));
const readPersistedStep2State = vi.fn(() => ({
  draft_status: "not_started",
  image_status: "not_started",
  review_status: "not_ready",
  publish_status: "not_started",
  blog_to_listing_link_status: "not_started",
  listing_to_blog_link_status: "not_started",
  draft_version: 0,
  image_version: 0,
  approved_at: null,
  approved_snapshot_draft_version: null,
  approved_snapshot_image_version: null,
}));
const markAuthorityReviewReady = vi.fn(async () => {});
const markAuthorityDraftFailure = vi.fn(async () => {});
const markAuthorityImageFailure = vi.fn(async () => {});
const patchAuthorityStep2State = vi.fn(async () => ({}));
const generateAuthorityDraft = vi.fn(async () => "<p>Draft html</p>");
const generateAuthorityImage = vi.fn(async () => "data:image/png;base64,smoke");
const validateOpenAiKeyPresent = vi.fn((value: string | null) => value || "smoke-key");

type JobAccepted = {
  status?: string;
  statusEndpoint?: string;
};

type JobStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
};

async function waitForJob(statusEndpoint: string): Promise<JobStatus> {
  const jobId = statusEndpoint.split("/").pop() ?? "";
  const { GET } = await import("@/app/api/directoryiq/jobs/[jobId]/route");
  for (let i = 0; i < 80; i += 1) {
    const res = await GET(new NextRequest(`http://localhost${statusEndpoint}`), { params: { jobId } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as JobStatus;
    if (json.status === "succeeded" || json.status === "failed" || json.status === "cancelled") return json;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for job: ${statusEndpoint}`);
}

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
  getAuthorityPostBySlot,
  readPersistedStep2State,
  markAuthorityReviewReady,
  markAuthorityDraftFailure,
  markAuthorityImageFailure,
  patchAuthorityStep2State,
}));
vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft,
  generateAuthorityImage,
  validateOpenAiKeyPresent,
}));
vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  ensureContextualListingLink: vi.fn((input: { html: string }) => input.html),
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
    const draftAccepted = (await draftRes.json()) as JobAccepted;
    const imageAccepted = (await imageRes.json()) as JobAccepted;

    expect(draftRes.status).toBe(202);
    expect(imageRes.status).toBe(202);
    expect(draftAccepted.status).toBe("queued");
    expect(imageAccepted.status).toBe("queued");

    const draftStatus = await waitForJob(String(draftAccepted.statusEndpoint));
    const imageStatus = await waitForJob(String(imageAccepted.statusEndpoint));
    expect(draftStatus.status).toBe("succeeded");
    expect(imageStatus.status).toBe("succeeded");
  });
});
