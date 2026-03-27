/**
 * Contract tests for POST /api/directoryiq/listings/[listingId]/authority/research/retry
 *
 * Covers:
 *   - 422 NO_FAILED_RESEARCH  – no failed slots found
 *   - 409 RESEARCH_IN_PROGRESS – slot already queued/researching
 *   - 409 RESEARCH_ALREADY_READY – all slots have a usable dossier contract
 *   - 422 MISSING_MISSION_PLAN  – failed slots found but no persisted mission plan
 *   - 202 happy path – failed slots with persisted mission_plan_slot → job accepted
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type JobAccepted = {
  jobId?: string;
  reqId?: string;
  acceptedAt?: string;
  status?: string;
  statusEndpoint?: string;
  retrying?: number[];
};

type ErrorBody = {
  error?: { code?: string; message?: string };
};

type JobStatusResponse = {
  jobId?: string;
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  result?: Record<string, unknown>;
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
  throw new Error(`Timed out waiting for job: ${statusEndpoint}`);
}

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const FIXTURE_LISTING_ID = "321";
const FIXTURE_LISTING_SOURCE_ID = "site-1:321";

const FIXTURE_MISSION_PLAN_SLOT = {
  slot_id: "publish_comparison_decision_post",
  listing_url: "https://example.com/listings/fixture-listing",
  recommended_focus_keyword: "miami vacation rental comparison",
};

const REAL_DOSSIER_CONTRACT = {
  research_artifact: {
    focus_keyword: "miami vacation rental comparison",
    top_results: [
      { title: "Best Miami Rentals", url: "https://example.com/listings/best-miami", rank: 1 },
      { title: "Guide to Miami", url: "https://example.org/miami-guide", rank: 2 },
      { title: "Comparison Site", url: "https://reviews.example.org/miami", rank: 3 },
    ],
    faq_patterns: ["pricing", "cancellation"],
    same_site_evidence: [{ title: "Related", url: "https://example.com/support/miami" }],
    entities: {
      amenities: ["pool", "wifi"],
      location: ["Miami"],
      intent: ["comparison"],
    },
    is_dossier_backed: true,
  },
  research_dossier: {
    owner_key: "site-1:321:phase1.v1",
    listing_identity: { listing_source_id: FIXTURE_LISTING_SOURCE_ID },
    step2_slot_research: [
      { slot: 1, slot_id: "publish_comparison_decision_post", focus_keyword: "miami vacation rental comparison" },
    ],
    serp_results: [{ title: "Result", link: "https://example.org/r1", snippet: "", position: 1 }],
  },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getSerpApiKeyForUser = vi.fn(async () => "serp-test-key");
const getAuthorityPosts = vi.fn(async (): Promise<Array<{ slot_index?: number; metadata_json?: Record<string, unknown> | null }>> => []);
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: FIXTURE_LISTING_SOURCE_ID,
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture-listing",
    raw_json: {
      listing_id: FIXTURE_LISTING_ID,
      group_name: "Fixture Listing",
      group_category: "Vacation Rental",
      city: "Miami",
      location_region: "Florida",
      description: "Spacious beachfront rental.",
    },
  },
  authorityPosts: [],
  evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
  settings: { imageStylePreference: "editorial clean" },
}));
const upsertAuthorityStep2ResearchContract = vi.fn(
  async (_userId: string, _listingId: string, _slot: number, _input: Record<string, unknown>) => {}
);
const getListingCurrentSupport = vi.fn(async () => ({
  listing: {
    id: FIXTURE_LISTING_ID,
    title: "Fixture Listing",
    canonicalUrl: "https://example.com/listings/fixture-listing",
    siteId: "site-1",
  },
  summary: {
    inboundLinkedSupportCount: 0,
    mentionWithoutLinkCount: 0,
    outboundSupportLinkCount: 0,
    connectedSupportPageCount: 0,
    lastGraphRunAt: null,
  },
  inboundLinkedSupport: [],
  mentionsWithoutLinks: [],
  outboundSupportLinks: [],
  connectedSupportPages: [],
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({ ensureUser, resolveUserId }));
vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({ getSerpApiKeyForUser }));
vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getAuthorityPosts,
  upsertAuthorityStep2ResearchContract,
  getAuthorityPostBySlot: vi.fn(async () => null),
  getListingEvaluation,
  findListingCandidates: vi.fn(async () => [
    { sourceId: FIXTURE_LISTING_SOURCE_ID, siteId: "site-1", siteLabel: "Site One" },
  ]),
  ensureAuthoritySlots: vi.fn(async () => {}),
}));
vi.mock("@/src/directoryiq/services/listingSupportService", () => ({ getListingCurrentSupport }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /authority/research/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSerpApiKeyForUser.mockResolvedValue("serp-test-key");
    getListingEvaluation.mockResolvedValue({
      listing: {
        source_id: FIXTURE_LISTING_SOURCE_ID,
        title: "Fixture Listing",
        url: "https://example.com/listings/fixture-listing",
        raw_json: {
          listing_id: FIXTURE_LISTING_ID,
          group_name: "Fixture Listing",
          group_category: "Vacation Rental",
          city: "Miami",
          location_region: "Florida",
          description: "Spacious beachfront rental.",
        },
      },
      authorityPosts: [],
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });
  });

  function retryRequest(listingId: string = FIXTURE_LISTING_ID): NextRequest {
    return new NextRequest(
      `http://localhost/api/directoryiq/listings/${listingId}/authority/research/retry`,
      { method: "POST" }
    );
  }

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------

  it("returns 422 NO_FAILED_RESEARCH when no slots are in failed state", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: { step2_research: { state: "not_started" } },
      },
    ]);

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(422);
    expect(body.error?.code).toBe("NO_FAILED_RESEARCH");
  });

  it("returns 409 RESEARCH_IN_PROGRESS when a slot is queued", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: { step2_research: { state: "queued" } },
      },
    ]);

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("RESEARCH_IN_PROGRESS");
  });

  it("returns 409 RESEARCH_IN_PROGRESS when a slot is researching", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: { step2_research: { state: "researching" } },
      },
    ]);

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("RESEARCH_IN_PROGRESS");
  });

  it("returns 409 RESEARCH_ALREADY_READY when all slots have a real dossier contract", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: { step2_contract: REAL_DOSSIER_CONTRACT },
      },
    ]);

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("RESEARCH_ALREADY_READY");
  });

  it("returns 422 MISSING_MISSION_PLAN when failed slots lack a persisted mission plan", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        // state=failed but no mission_plan_slot in step2_research
        metadata_json: {
          step2_research: {
            state: "failed",
            error_code: "DOSSIER_EMPTY",
          },
        },
      },
    ]);

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(422);
    expect(body.error?.code).toBe("MISSING_MISSION_PLAN");
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("accepts a retry job when failed slots have a persisted mission_plan_slot", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: {
          step2_research: {
            state: "failed",
            error_code: "DOSSIER_EMPTY",
            mission_plan_slot: FIXTURE_MISSION_PLAN_SLOT,
          },
        },
      },
    ]);

    const previousFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          organic_results: [
            {
              position: 1,
              title: "Best Miami vacation rentals",
              link: "https://example.org/miami-vacation-rentals",
              snippet: "Compare amenities, price, and location.",
            },
            {
              position: 2,
              title: "Miami beach rental guide",
              link: "https://example.org/miami-beach-guide",
              snippet: "Top questions asked before booking a Miami rental.",
            },
          ],
          related_questions: [
            { question: "Is parking free?" },
            { question: "Are pets allowed?" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as typeof fetch;

    try {
      const { POST } = await import(
        "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
      );
      const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
      const accepted = (await res.json()) as JobAccepted;

      expect(res.status).toBe(202);
      expect(accepted.status).toBe("queued");
      expect(accepted.jobId).toBeTruthy();
      expect(accepted.statusEndpoint).toContain("/api/directoryiq/jobs/");
      expect(accepted.retrying).toContain(1);

      const jobResult = await waitForJobCompletion(String(accepted.statusEndpoint));
      expect(jobResult.status).toBe("succeeded");
      expect(jobResult.result?.state).toBe("ready_thin");

      // The retry should have queued the slot with its mission plan persisted
      const queuedCall = upsertAuthorityStep2ResearchContract.mock.calls.find(
        (call) => (call[3] as Record<string, unknown>)?.state === "queued"
      );
      expect(queuedCall).toBeTruthy();
      const queuedInput = queuedCall?.[3] as Record<string, unknown> | undefined;
      expect(queuedInput?.missionPlanSlot).toBeTruthy();
      expect((queuedInput?.missionPlanSlot as Record<string, unknown> | undefined)?.slot_id).toBe(
        FIXTURE_MISSION_PLAN_SLOT.slot_id
      );
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("includes retrying slot list in the 202 response", async () => {
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 2,
        metadata_json: {
          step2_research: {
            state: "failed",
            mission_plan_slot: FIXTURE_MISSION_PLAN_SLOT,
          },
        },
      },
      {
        slot_index: 3,
        metadata_json: {
          step2_research: {
            state: "failed",
            mission_plan_slot: { ...FIXTURE_MISSION_PLAN_SLOT, slot_id: "audience_fit" },
          },
        },
      },
    ]);

    const previousFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          organic_results: [
            {
              position: 1,
              title: "Miami vacation rentals",
              link: "https://example.org/miami-rentals",
              snippet: "Top rated rentals in Miami.",
            },
          ],
          related_questions: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as typeof fetch;

    try {
      const { POST } = await import(
        "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
      );
      const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
      const accepted = (await res.json()) as JobAccepted;

      expect(res.status).toBe(202);
      expect(accepted.retrying).toBeTruthy();
      expect(accepted.retrying?.length).toBe(2);
      expect(accepted.retrying).toContain(2);
      expect(accepted.retrying).toContain(3);
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("uses persisted mission plan listing_url when canonical listing URL is missing", async () => {
    getSerpApiKeyForUser.mockResolvedValueOnce(null);
    getListingEvaluation.mockResolvedValueOnce({
      listing: {
        source_id: FIXTURE_LISTING_SOURCE_ID,
        title: "Fixture Listing",
        url: "",
        raw_json: {
          listing_id: FIXTURE_LISTING_ID,
          group_name: "Fixture Listing",
          group_category: "Vacation Rental",
          city: "Miami",
          location_region: "Florida",
          group_filename: "listings/fixture-listing",
        },
      },
      authorityPosts: [],
      evaluation: { totalScore: 50, scores: {}, caps: [], flags: {} },
      settings: { imageStylePreference: "editorial clean" },
    });
    getAuthorityPosts.mockResolvedValueOnce([
      {
        slot_index: 1,
        metadata_json: {
          step2_research: {
            state: "failed",
            error_code: "DOSSIER_EMPTY",
            mission_plan_slot: FIXTURE_MISSION_PLAN_SLOT,
          },
        },
      },
    ]);
    getListingCurrentSupport.mockResolvedValueOnce({
      listing: {
        id: FIXTURE_LISTING_ID,
        title: "Fixture Listing",
        canonicalUrl: null,
        siteId: "site-1",
      },
      summary: {
        inboundLinkedSupportCount: 0,
        mentionWithoutLinkCount: 0,
        outboundSupportLinkCount: 0,
        connectedSupportPageCount: 0,
        lastGraphRunAt: null,
      },
      inboundLinkedSupport: [],
      mentionsWithoutLinks: [],
      outboundSupportLinks: [],
      connectedSupportPages: [],
    });

    const { POST } = await import(
      "@/app/api/directoryiq/listings/[listingId]/authority/research/retry/route"
    );
    const res = await POST(retryRequest(), { params: { listingId: FIXTURE_LISTING_ID } });
    const accepted = (await res.json()) as JobAccepted;
    expect(res.status).toBe(202);

    const jobResult = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(jobResult.status).toBe("succeeded");
    expect(jobResult.result?.state).toBe("ready_thin");

    const readyCall = upsertAuthorityStep2ResearchContract.mock.calls.find(
      (call) => (call[3] as Record<string, unknown>)?.state === "ready_thin"
    );
    expect(readyCall).toBeTruthy();
    const readyInput = readyCall?.[3] as Record<string, unknown> | undefined;
    const contract = (readyInput?.contract ?? {}) as Record<string, unknown>;
    const artifact = (contract.research_artifact ?? {}) as Record<string, unknown>;
    const topResults = Array.isArray(artifact.top_results) ? artifact.top_results : [];
    expect(topResults.length).toBeGreaterThan(0);
    expect((topResults[0] as { url?: string }).url).toBe(FIXTURE_MISSION_PLAN_SLOT.listing_url);
  });
});
