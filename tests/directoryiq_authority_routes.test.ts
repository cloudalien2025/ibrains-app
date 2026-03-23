import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthorityRouteError } from "@/app/api/directoryiq/_utils/authorityErrors";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";

type JobAccepted = {
  jobId?: string;
  reqId?: string;
  acceptedAt?: string;
  status?: string;
  statusEndpoint?: string;
};

type JobStatusResponse = {
  jobId?: string;
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage?: string;
  reqId?: string;
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    details?: string;
    reqId?: string;
  };
};

async function waitForJobCompletion(statusEndpoint: string): Promise<JobStatusResponse> {
  const jobId = statusEndpoint.split("/").pop() ?? "";
  const { GET } = await import("@/app/api/directoryiq/jobs/[jobId]/route");

  for (let i = 0; i < 80; i += 1) {
    const res = await GET(new NextRequest(`http://localhost${statusEndpoint}`), { params: { jobId } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as JobStatusResponse;
    if (json.status === "succeeded" || json.status === "failed" || json.status === "cancelled") {
      return json;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for job status endpoint: ${statusEndpoint}`);
}

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "site-1:321",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: { description: "Sample listing description", user_id: "98765", group_filename: "fixture-listing" },
  },
  evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
  settings: { imageStylePreference: "editorial clean" },
}));
const findListingCandidates = vi.fn(async () => [
  { sourceId: "site-1:321", siteId: "site-1", siteLabel: "Site One" },
]);
const getBdSite = vi.fn(async () => ({
  id: "site-1",
  base_url: "https://example.com",
}));
const upsertAuthorityPostDraft = vi.fn(async () => {});
const saveAuthorityImage = vi.fn(async () => {});
const getAuthorityPostBySlot = vi.fn(async () => ({
  id: "authority-post-1",
  title: "Fixture Blog Post",
  draft_html: "<p>Draft html with contextual link.</p>",
  featured_image_url: null,
  blog_to_listing_link_status: "linked",
  metadata_json: {
    step2_contract: {
      seo_package: {
        primary_focus_keyword: "fixture keyword",
        seo_title: "Fixture SEO title",
        meta_description: "Fixture SEO description",
        slug: "fixture-blog-post",
        featured_image_filename: "fixture.webp",
        featured_image_alt_text: "Fixture image alt",
      },
    },
  },
}));
const addDirectoryIqVersion = vi.fn(async () => "version-1");
const markPostPublished = vi.fn(async () => {});
const proxyDirectoryIqRequest = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 502 }));
const shouldServeDirectoryIqLocally = vi.fn(() => true);
const generateAuthorityDraft = vi.fn(async () => "<p>Draft html</p>");
const generateAuthorityImage = vi.fn(async () => "data:image/png;base64,abc123");
const getDirectoryIqBdConnection = vi.fn(async () => ({
  baseUrl: "https://example.com",
  apiKey: "test-bd-key",
  listingsSearchPath: "/api/v2/users_portfolio_groups/search",
  dataPostsSearchPath: "/api/v2/data_posts/search",
  dataPostsUpdatePath: "/api/v2/data_posts/update",
  dataPostsCreatePath: "/api/v2/data_posts/create",
  listingsDataId: 75,
  blogPostsDataId: 14,
}));
const publishBlogPostToBd = vi.fn(async () => ({
  ok: true,
  status: 200,
  body: { post_id: "blog-900", url: "https://example.com/blog/fixture-blog-post" },
}));
const resolveBlogPostDataTypeForPublish = vi.fn(async () => ({ dataType: 4, source: "data_category_get" as const }));
const pushListingUpdateToBd = vi.fn(async () => ({ ok: true, status: 200, body: {} }));
const resolveTruePostIdForListing = vi.fn(async () => ({ truePostId: "listing-123", mappingKey: "slug" as const }));
const persistListingTruePostMapping = vi.fn(async () => {});
const validateDraftHtml = vi.fn((input: { html: string; listingUrl: string }) => {
  const hasContextualListingLink = Boolean(input.listingUrl) && input.html.includes(input.listingUrl);
  return {
    valid: hasContextualListingLink,
    hasContextualListingLink,
    errors: hasContextualListingLink ? ([] as string[]) : ["Draft must include a contextual in-body link to the listing URL."],
  };
});
const ensureContextualListingLink = vi.fn((input: { html: string; listingUrl: string; listingTitle: string; focusTopic: string }) => {
  if (!input.listingUrl || input.html.includes(input.listingUrl)) return input.html;
  return `${input.html}\n\nFor ${input.focusTopic}, see [${input.listingTitle}](${input.listingUrl}).`;
});
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
  getDirectoryIqBdConnection,
  publishBlogPostToBd,
  resolveBlogPostDataTypeForPublish,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
}));
vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest,
}));
vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  findListingCandidates,
  upsertAuthorityPostDraft,
  saveAuthorityImage,
  getAuthorityPostBySlot,
  addDirectoryIqVersion,
  markPostPublished,
}));
vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  getBdSite,
}));

vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft,
  generateAuthorityImage,
  validateOpenAiKeyPresent,
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  validateDraftHtml,
  ensureContextualListingLink,
  buildImagePrompt: vi.fn(() => "image prompt"),
}));

vi.mock("@/src/directoryiq/repositories/listingIdentityRepo", () => ({
  persistListingTruePostMapping,
}));

describe("directoryiq authority routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft job for an authority slot", async () => {
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

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    expect(accepted.status).toBe("queued");
    expect(accepted.jobId).toBeTruthy();
    expect(accepted.statusEndpoint).toContain("/api/directoryiq/jobs/");

    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(status.result?.ok).toBe(true);
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
    expect(upsertAuthorityPostDraft).toHaveBeenCalledTimes(1);
  });

  it("accepts slot 5 for draft generation and persistence", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/5/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Fifth slot draft",
        focus_topic: "experience itinerary support",
        type: "contextual_guide",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "5" } });
    const accepted = (await submitRes.json()) as JobAccepted;
    expect(submitRes.status).toBe(202);

    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(upsertAuthorityPostDraft).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "site-1:321",
      5,
      expect.any(Object)
    );
  });

  it("rejects out-of-range slot values with BAD_REQUEST", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/6/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid slot draft",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "6" } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error?.code).toBe("BAD_REQUEST");
    expect(String(json.error?.message ?? "")).toContain("between 1 and 5");
    expect(generateAuthorityDraft).not.toHaveBeenCalled();
    expect(upsertAuthorityPostDraft).not.toHaveBeenCalled();
  });

  it("returns failed job status when OpenAI key is missing", async () => {
    getDirectoryIqOpenAiKey.mockResolvedValueOnce(null as unknown as string);
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("OPENAI_KEY_MISSING");
    expect(saveAuthorityImage).not.toHaveBeenCalled();
  });

  it("returns success result for image generation and persists the image", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(status.result?.ok).toBe(true);
    expect(status.result?.featured_image_url).toBe("data:image/png;base64,abc123");
    expect(status.result?.prompt).toBe("image prompt");
    expect(generateAuthorityImage).toHaveBeenCalledTimes(1);
    expect(saveAuthorityImage).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "site-1:321", 1, {
      imagePrompt: "image prompt",
      imageUrl: "data:image/png;base64,abc123",
    });
  });

  it("maps image upstream payload-contract failures to failed job error envelope", async () => {
    generateAuthorityImage.mockRejectedValueOnce(
      new AuthorityRouteError(502, "OPENAI_UPSTREAM", "OpenAI request failed.", "Unknown parameter: 'response_format'.")
    );

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("OPENAI_UPSTREAM");
    expect(status.error?.message).toBe("OpenAI request failed.");
    expect(status.error?.details).toContain("Unknown parameter: 'response_format'.");
    expect(saveAuthorityImage).not.toHaveBeenCalled();
  });

  it("keeps image generation on the canonical local path even when parity helper reports proxy host", async () => {
    shouldServeDirectoryIqLocally.mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/image", {
      method: "POST",
      body: JSON.stringify({
        focus_topic: "guide image",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(proxyDirectoryIqRequest).not.toHaveBeenCalled();
  });

  it("returns failed job with DRAFT_VALIDATION_FAILED when generated draft misses governance checks", async () => {
    validateDraftHtml.mockReturnValueOnce({
      valid: false,
      hasContextualListingLink: false,
      errors: ["Missing contextual listing link."],
    });
    validateDraftHtml.mockReturnValueOnce({
      valid: false,
      hasContextualListingLink: false,
      errors: ["Missing contextual listing link."],
    });

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

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("DRAFT_VALIDATION_FAILED");
    expect(String(status.error?.message ?? "")).toContain("Draft failed governance validation");
  });

  it("uses listing URL fallback fields from listing raw_json for draft generation", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: null,
        raw_json: {
          description: "Sample listing description",
          profile_url: "https://example.com/listings/fixture-listing",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

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

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
  });

  it("composes canonical listing URL from site base_url + listing path when listing URL fields are blank", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:15",
        title: "Almresi Vail",
        url: "",
        raw_json: {
          description: "Sample listing description",
          group_filename: "listings/almresi-vail",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });
    getBdSite.mockResolvedValueOnce({
      id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      base_url: "https://www.vailvacay.com",
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/15/authority/3/draft?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Best in Vail",
          focus_topic: "restaurants in vail village",
          type: "local_guide",
        }),
        headers: { "content-type": "application/json" },
      }
    );

    const submitRes = await POST(req, { params: { listingId: "15", slot: "3" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(validateDraftHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        listingUrl: "https://www.vailvacay.com/listings/almresi-vail",
      })
    );
  });

  it("uses step2 contract mission plan listing_url fallback for reciprocal slot draft generation", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: null,
        raw_json: {
          description: "Sample listing description",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/4/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Reciprocal support post",
        focus_topic: "supportive scenario guide",
        type: "local_guide",
        step2_contract: {
          mission_plan_slot: {
            slot_id: "publish_reciprocal_support_post",
            listing_url: "https://example.com/listings/fixture-listing",
          },
        },
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "4" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(generateAuthorityDraft).toHaveBeenCalledTimes(1);
    expect(validateDraftHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        listingUrl: "https://example.com/listings/fixture-listing",
      })
    );
  });

  it("still fails with BAD_REQUEST when listing URL is irrecoverable after all resolver candidates", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: null,
        raw_json: {
          description: "Sample listing description",
          listing_url: "",
          profile_url: "",
          source_url: "",
          group_filename: "",
          path: "",
          slug: "",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });
    getBdSite.mockResolvedValueOnce({
      id: "site-1",
      base_url: "https://example.com",
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        title: "No URL draft",
        focus_topic: "best service area guide",
        type: "comparison",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("BAD_REQUEST");
    expect(String(status.error?.message ?? "")).toContain("Listing URL is required");
  });

  it("deterministically enforces contextual listing link before governance validation when draft omits the URL", async () => {
    generateAuthorityDraft.mockResolvedValueOnce("Plain draft without required listing URL.");

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/2/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "Missing Link Draft",
        focus_topic: "best service area guide",
        type: "local_guide",
      }),
      headers: { "content-type": "application/json" },
    });

    const submitRes = await POST(req, { params: { listingId: "321", slot: "2" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(ensureContextualListingLink).toHaveBeenCalledTimes(1);
    expect(validateDraftHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("https://example.com/listings/fixture-listing"),
        listingUrl: "https://example.com/listings/fixture-listing",
      })
    );
  });

  it("maps transient DB timeout errors into failed job status payload", async () => {
    generateAuthorityDraft.mockRejectedValueOnce(
      Object.assign(new Error("connect ETIMEDOUT 45.55.71.52:25060"), {
        code: "ETIMEDOUT",
        syscall: "connect",
        address: "45.55.71.52",
        port: 25060,
      })
    );

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

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("ETIMEDOUT");
  });

  it("maps transient network connectivity errors into failed job status payload", async () => {
    generateAuthorityDraft.mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND upstream.service.local"), {
        code: "ENOTFOUND",
        syscall: "getaddrinfo",
      })
    );

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

    const submitRes = await POST(req, { params: { listingId: "321", slot: "1" } });
    const accepted = (await submitRes.json()) as JobAccepted;

    expect(submitRes.status).toBe(202);
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("ENOTFOUND");
  });

  it("emits reqId/jobId stage and final logs for success and failure", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");

      const successReq = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
        method: "POST",
        body: JSON.stringify({
          title: "Best in Miami",
          focus_topic: "best service area guide",
          type: "comparison",
        }),
        headers: { "content-type": "application/json" },
      });
      const successSubmit = await POST(successReq, { params: { listingId: "321", slot: "1" } });
      const successAccepted = (await successSubmit.json()) as JobAccepted;
      expect(successSubmit.status).toBe(202);
      await waitForJobCompletion(String(successAccepted.statusEndpoint));

      const successSummaryCall = infoSpy.mock.calls.find(
        (call) => call[0] === "[directoryiq-job]" && call[1]?.phase === "final_success"
      );
      expect(successSummaryCall).toBeTruthy();
      expect(successSummaryCall?.[1]).toMatchObject({
        routeOrigin: "directoryiq.authority.step2.draft",
        runtimeOwner: "directoryiq-api.ibrains.ai",
      });
      expect(typeof successSummaryCall?.[1]?.reqId).toBe("string");
      expect(typeof successSummaryCall?.[1]?.jobId).toBe("string");

      generateAuthorityDraft.mockRejectedValueOnce(
        Object.assign(new Error("Connection terminated due to connection timeout"), {
          code: "ETIMEDOUT",
          syscall: "connect",
        })
      );

      const failureReq = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/draft", {
        method: "POST",
        body: JSON.stringify({
          title: "Best in Miami",
          focus_topic: "best service area guide",
          type: "comparison",
        }),
        headers: { "content-type": "application/json" },
      });
      const failureSubmit = await POST(failureReq, { params: { listingId: "321", slot: "1" } });
      const failureAccepted = (await failureSubmit.json()) as JobAccepted;
      expect(failureSubmit.status).toBe(202);
      const failureStatus = await waitForJobCompletion(String(failureAccepted.statusEndpoint));
      expect(failureStatus.status).toBe("failed");

      const routeFailureCall = infoSpy.mock.calls.find(
        (call) => call[0] === "[directoryiq-job]" && call[1]?.phase === "final_failure"
      );
      expect(routeFailureCall?.[1]).toMatchObject({
        routeOrigin: "directoryiq.authority.step2.draft",
      });
      expect(typeof routeFailureCall?.[1]?.reqId).toBe("string");
      expect(typeof routeFailureCall?.[1]?.jobId).toBe("string");
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("publishes authority draft with BD-required user_id and data_type contract fields", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const approvalToken = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      action: "blog_publish",
      slot: 1,
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        approve_publish: true,
        approval_token: approvalToken,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(publishBlogPostToBd).toHaveBeenCalledWith(
      expect.objectContaining({
        blogDataId: 14,
        blogDataType: 4,
        bdUserId: "98765",
      })
    );
    expect(resolveTruePostIdForListing).toHaveBeenCalledWith(
      expect.objectContaining({
        dataPostsSearchPath: "/api/v2/users_portfolio_groups/search",
        listingsDataId: 75,
      })
    );
  });

  it("returns BAD_REQUEST when listing payload cannot resolve BD publish user_id", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: "https://example.com/listings/fixture-listing",
        raw_json: { description: "Sample listing description", group_filename: "fixture-listing" },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const approvalToken = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      action: "blog_publish",
      slot: 1,
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        approve_publish: true,
        approval_token: approvalToken,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error?.code).toBe("BAD_REQUEST");
    expect(String(json.error?.message ?? "")).toContain("Listing owner user_id is required");
    expect(publishBlogPostToBd).not.toHaveBeenCalled();
  });

  it("returns BAD_REQUEST when publish target data_type cannot be resolved", async () => {
    resolveBlogPostDataTypeForPublish.mockResolvedValueOnce({ dataType: null, source: "missing" as const });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const approvalToken = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      action: "blog_publish",
      slot: 1,
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        approve_publish: true,
        approval_token: approvalToken,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error?.code).toBe("BAD_REQUEST");
    expect(String(json.error?.message ?? "")).toContain("data_type is required");
    expect(publishBlogPostToBd).not.toHaveBeenCalled();
  });

  it("uses local group_id fast-path for reciprocal listing true post id on listings-search families", async () => {
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: "site-1:321",
        title: "Fixture Listing",
        url: "https://example.com/listings/fixture-listing",
        raw_json: {
          description: "Sample listing description",
          user_id: "98765",
          group_id: "15",
          group_filename: "listings/fixture-listing",
          group_name: "Fixture Listing",
        },
      },
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const approvalToken = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      action: "blog_publish",
      slot: 1,
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        approve_publish: true,
        approval_token: approvalToken,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(resolveTruePostIdForListing).not.toHaveBeenCalled();
    expect(pushListingUpdateToBd).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "15",
      })
    );
  });

  it("returns BD_LINK_ENFORCEMENT_FAILED when reciprocal listing true post id remains unresolved", async () => {
    resolveTruePostIdForListing.mockResolvedValueOnce({ truePostId: null, mappingKey: "unresolved" as const });

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const approvalToken = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      action: "blog_publish",
      slot: 1,
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish?site_id=site-1", {
      method: "POST",
      body: JSON.stringify({
        approve_publish: true,
        approval_token: approvalToken,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321", slot: "1" } });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error?.code).toBe("BD_LINK_ENFORCEMENT_FAILED");
    expect(String(json.error?.details ?? "")).toContain("Unable to resolve listing true post id for reciprocal link write");
    expect(pushListingUpdateToBd).not.toHaveBeenCalled();
  });
});
