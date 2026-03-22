import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "site-1:321",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: { description: "Current description." },
  },
  evaluation: {
    totalScore: 44,
    gapsByPillar: { structure: ["Add specific services"], clarity: ["Remove vague claims"] },
  },
}));
const findListingCandidates = vi.fn(async () => [
  { sourceId: "site-1:321", siteId: "site-1", siteLabel: "Site One" },
]);
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
const resolveTruePostIdForListing = vi.fn(async () => ({ truePostId: "123", mappingKey: "slug" as const }));
const persistListingTruePostMapping = vi.fn(async () => {});
const getDirectoryIqBdConnection = vi.fn(async () => ({
  baseUrl: "https://example.com",
  apiKey: "k",
  listingsSearchPath: "/api/v2/users_portfolio_groups/search",
  dataPostsSearchPath: "/api/v2/data_posts/search",
  dataPostsUpdatePath: "/api/v2/data_posts/update",
  dataPostsCreatePath: "/api/v2/data_posts/create",
  listingsDataId: 75,
  blogPostsDataId: 14,
}));
const pushListingUpdateToBd = vi.fn(async () => ({ ok: true, status: 200, body: {} }));
const resolveListingEvaluation = vi.fn(async () => ({
  siteId: "site-1",
  listingEval: {
    listing: {
      source_id: "site-1:321",
      title: "Fixture Listing",
      raw_json: { group_name: "Fixture Listing", group_filename: "fixture-listing" },
    },
    evaluation: {
      totalScore: 44,
      scores: { structure: 40, clarity: 40, trust: 40, authority: 40, actionability: 40 },
    },
  },
}));

const validateOpenAiKeyPresent = vi.fn((value: string | null) => {
  if (!value) throw new Error("OpenAI API not configured. Go to DirectoryIQ -> Signal Sources.");
  return value;
});
const generateListingUpgradeDraft = vi.fn(async () => "Improved description.");
const generateUpgrade = vi.fn(async () => {
  const key = await getDirectoryIqOpenAiKey();
  if (!key) {
    throw new DirectoryIqServiceError({
      message: "OpenAI key missing",
      status: 400,
      code: "OPENAI_KEY_MISSING",
      reqId: "req-missing-key",
    });
  }

  const proposedText = await generateListingUpgradeDraft();
  const draft = await createListingUpgradeDraft();

  return {
    draft: {
      id: draft.id,
      proposedText,
    },
    reqId: "req-generate-upgrade",
  };
});
const pushUpgrade = vi.fn(async () => {
  await markListingUpgradePushed();
  return { reqId: "req-push-upgrade", draftId: "draft-1", bdRef: "bd-ref-1" };
});

type JobAccepted = {
  jobId?: string;
  status?: string;
  statusEndpoint?: string;
};

type JobStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  result?: Record<string, unknown>;
  error?: { code?: string };
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
  getDirectoryIqBdConnection,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  ListingSiteRequiredError: class ListingSiteRequiredError extends Error {
    candidates: Array<{ siteId: string; siteLabel: string | null }>;
    constructor(candidates: Array<{ siteId: string; siteLabel: string | null }>) {
      super("site_required");
      this.name = "ListingSiteRequiredError";
      this.candidates = candidates;
    }
  },
  resolveListingEvaluation,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  findListingCandidates,
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

vi.mock("@/src/directoryiq/services/upgradeService", () => ({
  generateUpgrade,
  pushUpgrade,
}));

vi.mock("@/src/directoryiq/repositories/listingIdentityRepo", () => ({
  persistListingTruePostMapping,
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
    const res = await POST(req, { params: { listingId: "321" } });
    const accepted = (await res.json()) as JobAccepted;

    expect(res.status).toBe(202);
    expect(accepted.status).toBe("queued");
    const status = await waitForJob(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(status.result?.draftId).toBe("draft-1");
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
    const res = await POST(req, { params: { listingId: "321" } });
    const accepted = (await res.json()) as JobAccepted;

    expect(res.status).toBe(202);
    const status = await waitForJob(String(accepted.statusEndpoint));
    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("OPENAI_KEY_MISSING");
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

    const res = await POST(req, { params: { listingId: "321" } });
    const accepted = (await res.json()) as JobAccepted;
    expect(res.status).toBe(202);
    const status = await waitForJob(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");
    expect(status.result?.ok).toBe(true);
    expect(markListingUpgradePushed).toHaveBeenCalledTimes(1);
  });

  it("listing push route refuses when true post id is unresolved", async () => {
    resolveTruePostIdForListing.mockResolvedValueOnce({ truePostId: null, mappingKey: "unresolved" });
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/listing-push/route");
    const token = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "321",
      action: "listing_push",
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/listing-push", {
      method: "POST",
      body: JSON.stringify({
        approve_push: true,
        proposed_description: "Improved description.",
        approval_token: token,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toContain("Unable to resolve true BD post_id");
    expect(pushListingUpdateToBd).not.toHaveBeenCalled();
    expect(persistListingTruePostMapping).not.toHaveBeenCalled();
  });

  it("listing push route persists resolved true post id when fallback resolver succeeds", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/listing-push/route");
    const token = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "321",
      action: "listing_push",
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/listing-push", {
      method: "POST",
      body: JSON.stringify({
        approve_push: true,
        proposed_description: "Improved description.",
        approval_token: token,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321" } });
    expect(res.status).toBe(200);
    expect(resolveTruePostIdForListing).toHaveBeenCalledTimes(1);
    expect(persistListingTruePostMapping).toHaveBeenCalledWith({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "site-1:321",
      truePostId: "123",
      mappingKey: "slug",
    });
  });

  it("listing push route reuses persisted true post id before resolver fallback", async () => {
    resolveListingEvaluation.mockResolvedValueOnce({
      siteId: "site-1",
      listingEval: {
        listing: {
          source_id: "site-1:321",
          title: "Fixture Listing",
          raw_json: {
            group_name: "Fixture Listing",
            group_filename: "fixture-listing",
            true_post_id: "998",
          },
        },
        evaluation: {
          totalScore: 44,
          scores: { structure: 40, clarity: 40, trust: 40, authority: 40, actionability: 40 },
        },
      },
    });
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/listing-push/route");
    const token = issueApprovalToken({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "321",
      action: "listing_push",
    });
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/listing-push", {
      method: "POST",
      body: JSON.stringify({
        approve_push: true,
        proposed_description: "Improved description.",
        approval_token: token,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: { listingId: "321" } });
    expect(res.status).toBe(200);
    expect(resolveTruePostIdForListing).not.toHaveBeenCalled();
    expect(persistListingTruePostMapping).not.toHaveBeenCalled();
  });
});
