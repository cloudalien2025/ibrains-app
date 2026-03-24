import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type JobAccepted = {
  statusEndpoint?: string;
};

type JobStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
};

type PersistedState = {
  draft_status: string;
  image_status: string;
  review_status: string;
  publish_status: string;
  blog_to_listing_link_status: string;
  listing_to_blog_link_status: string;
  draft_version: number;
  image_version: number;
  draft_last_error_code: string | null;
  draft_last_error_message: string | null;
};

type AuthorityPost = {
  id: string;
  title: string;
  draft_html: string | null;
  featured_image_url: string | null;
  blog_to_listing_link_status: "linked" | "missing";
  listing_to_blog_link_status: "linked" | "missing";
  metadata_json: Record<string, unknown>;
};

function createStep2State(overrides?: Partial<PersistedState>): PersistedState {
  return {
    draft_status: "ready",
    image_status: "ready",
    review_status: "ready",
    publish_status: "not_started",
    blog_to_listing_link_status: "linked",
    listing_to_blog_link_status: "not_started",
    draft_version: 1,
    image_version: 1,
    draft_last_error_code: null,
    draft_last_error_message: null,
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStep2State(metadata: Record<string, unknown> | null | undefined): PersistedState {
  const step2 = asRecord(asRecord(metadata).step2_state);
  return createStep2State({
    draft_status: typeof step2.draft_status === "string" ? step2.draft_status : "not_started",
    image_status: typeof step2.image_status === "string" ? step2.image_status : "not_started",
    review_status: typeof step2.review_status === "string" ? step2.review_status : "not_ready",
    publish_status: typeof step2.publish_status === "string" ? step2.publish_status : "not_started",
    blog_to_listing_link_status:
      typeof step2.blog_to_listing_link_status === "string" ? step2.blog_to_listing_link_status : "not_started",
    listing_to_blog_link_status:
      typeof step2.listing_to_blog_link_status === "string" ? step2.listing_to_blog_link_status : "not_started",
    draft_version: typeof step2.draft_version === "number" ? step2.draft_version : 0,
    image_version: typeof step2.image_version === "number" ? step2.image_version : 0,
    draft_last_error_code: typeof step2.draft_last_error_code === "string" ? step2.draft_last_error_code : null,
    draft_last_error_message: typeof step2.draft_last_error_message === "string" ? step2.draft_last_error_message : null,
  });
}

async function waitForJobCompletion(statusEndpoint: string): Promise<JobStatus> {
  const jobId = statusEndpoint.split("/").pop() ?? "";
  const { GET } = await import("@/app/api/directoryiq/jobs/[jobId]/route");

  for (let i = 0; i < 100; i += 1) {
    const res = await GET(new NextRequest(`http://localhost${statusEndpoint}`), { params: { jobId } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as JobStatus;
    if (json.status === "succeeded" || json.status === "failed" || json.status === "cancelled") {
      return json;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for job ${statusEndpoint}`);
}

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const requireDirectoryIqWriteUser = vi.fn(async () => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqOpenAiKey = vi.fn(async () => "test-key");
const getBdSite = vi.fn(async () => ({ base_url: "https://example.com" }));
const resolveListingEvaluation = vi.fn(async () => ({
  siteId: "site-1",
  listingEval: {
    listing: {
      source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:142",
      title: "Cedar at Streamside",
      url: "https://example.com/listings/cedar-at-streamside",
      raw_json: {
        group_category: "Hotels",
        city: "Vail",
        state_sn: "CO",
      },
    },
    evaluation: { totalScore: 54, scores: {}, caps: [], flags: {} },
    settings: { imageStylePreference: "editorial clean" },
  },
}));

const buildListingFaqSupportEngine = vi.fn();
const markAuthorityReviewReady = vi.fn(async () => {});
const upsertAuthorityPostDraft = vi.fn(async () => {});
const markAuthorityDraftFailure = vi.fn(async () => {});
const markAuthorityApprovedSnapshot = vi.fn(async () => createStep2State({ review_status: "approved" }));

let persistedPost: AuthorityPost;

const getAuthorityPostBySlot = vi.fn(async () => clone(persistedPost));

const readPersistedStep2State = vi.fn((metadata: Record<string, unknown> | null | undefined) => readStep2State(metadata));

function resetPersistedPost() {
  persistedPost = {
    id: "authority-post-142-2",
    title: "Publish an FAQ support page for pre selection friction FAQ",
    draft_html:
      "<h2>Publish an FAQ support page for pre selection friction FAQ</h2><p>Yes. 2244 S Frontage Rd W Cedar Building...</p>",
    featured_image_url: "https://img.example.com/old.png",
    blog_to_listing_link_status: "linked",
    listing_to_blog_link_status: "missing",
    metadata_json: {
      step2_state: createStep2State(),
      step2_contract: {
        mission_plan_slot: { slot_id: "publish_faq_support_post" },
        research_artifact: {
          focus_keyword: "cedar at streamside booking faq",
          top_results: [{ title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" }],
        },
      },
    },
  };
}

upsertAuthorityPostDraft.mockImplementation(async (_userId: string, _listingId: string, _slot: number, input: {
  title: string;
  draftHtml: string;
  metadata: Record<string, unknown>;
}) => {
  persistedPost = {
    ...persistedPost,
    title: input.title,
    draft_html: input.draftHtml,
    metadata_json: clone(input.metadata),
    blog_to_listing_link_status: "linked",
  };
});

markAuthorityDraftFailure.mockImplementation(async (_userId: string, _listingId: string, _slot: number, input: {
  code?: string | null;
  message?: string | null;
}) => {
  const current = readStep2State(persistedPost.metadata_json);
  persistedPost = {
    ...persistedPost,
    metadata_json: {
      ...persistedPost.metadata_json,
      step2_state: {
        ...current,
        draft_status: "failed",
        draft_last_error_code: input.code ?? null,
        draft_last_error_message: input.message ?? null,
      },
    },
  };
});

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/writeAuth", () => ({
  requireDirectoryIqWriteUser,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  getBdSite,
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation,
  ListingSiteRequiredError: class ListingSiteRequiredError extends Error {
    candidates: Array<{ siteId: string; siteLabel: string | null }>;
    constructor(candidates: Array<{ siteId: string; siteLabel: string | null }> = []) {
      super("Listing site required");
      this.candidates = candidates;
    }
  },
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getAuthorityPostBySlot,
  markAuthorityDraftFailure,
  markAuthorityReviewReady,
  readPersistedStep2State,
  upsertAuthorityPostDraft,
  markAuthorityApprovedSnapshot,
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt: vi.fn(() => "prompt"),
  ensureContextualListingLink: vi.fn((input: { html: string }) => input.html),
  validateDraftHtml: vi.fn(() => ({ valid: true, hasContextualListingLink: true, errors: [] })),
}));

vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft: vi.fn(async () => "<p>unused</p>"),
  validateOpenAiKeyPresent: vi.fn((value: string | null) => value || "test-key"),
}));

vi.mock("@/lib/directoryiq/faq/engine", () => ({
  buildListingFaqSupportEngine,
}));

describe("faq regenerate persistence and preview current-artifact behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPersistedPost();
  });

  it("does not surface stale persisted FAQ html in preview after failed regenerate", async () => {
    buildListingFaqSupportEngine.mockReturnValueOnce({
      publish_gate_result: { allowPublish: false, reasons: ["not enough grounded facts"] },
      rendered_html: "",
      context: {},
      resolved_intent_clusters: [],
      candidate_questions: [],
      selected_questions: [],
      source_facts: [],
      fact_confidence_map: {},
      quality: {
        listing_specificity: 0,
        local_relevance: 0,
        directness: 0,
        factual_grounding: 0,
        selection_intent_coverage: 0,
        answer_completeness: 0,
        internal_link_quality: 0,
        generic_language_penalty: 0,
      },
    });

    const { POST: draftPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Booking FAQ for Cedar at Streamside",
        focus_topic: "faq booking questions",
        type: "contextual_guide",
        step2_contract: {
          mission_plan_slot: { slot_id: "publish_faq_support_post" },
          research_artifact: {
            focus_keyword: "cedar at streamside booking faq",
            top_results: [{ title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" }],
            common_user_questions: ["Is parking available?"],
            common_entities: ["parking"],
            common_locations: ["Vail"],
            common_decision_factors: ["policies"],
            content_gaps_opportunities: ["Missing fee transparency"],
          },
        },
      }),
    });

    const draftRes = await draftPost(draftReq, { params: { listingId: "142", slot: "2" } });
    expect(draftRes.status).toBe(202);
    const accepted = (await draftRes.json()) as JobAccepted;
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));

    expect(status.status).toBe("failed");
    expect(status.error?.code).toBe("FAQ_PUBLISH_GATE_BLOCKED");
    expect(markAuthorityDraftFailure).toHaveBeenCalledTimes(1);
    expect(persistedPost.draft_html).toContain("Publish an FAQ support page");

    const { POST: previewPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/preview/route");
    const previewReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/preview?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "preview" }),
    });

    const previewRes = await previewPost(previewReq, { params: { listingId: "142", slot: "2" } });
    const previewJson = (await previewRes.json()) as { error?: { code?: string; message?: string } };

    expect(previewRes.status).toBe(409);
    expect(previewJson.error?.code).toBe("DRAFT_NOT_READY");
    expect(String(previewJson.error?.message ?? "")).toContain("Draft is not ready");
  });

  it("persists new FAQ draft html/version on regenerate success and preview returns the new artifact", async () => {
    buildListingFaqSupportEngine.mockReturnValueOnce({
      publish_gate_result: { allowPublish: true, reasons: [] },
      rendered_html: "<h2>FAQ</h2><p>New grounded answer.</p>",
      context: {},
      resolved_intent_clusters: [],
      candidate_questions: [],
      selected_questions: [],
      source_facts: ["source A"],
      fact_confidence_map: {},
      quality: {
        listing_specificity: 90,
        local_relevance: 90,
        directness: 90,
        factual_grounding: 90,
        selection_intent_coverage: 90,
        answer_completeness: 90,
        internal_link_quality: 90,
        generic_language_penalty: 0,
      },
    });

    const { POST: draftPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Booking FAQ for Cedar at Streamside",
        focus_topic: "faq booking questions",
        type: "contextual_guide",
        step2_contract: {
          mission_plan_slot: { slot_id: "publish_faq_support_post" },
          research_artifact: {
            focus_keyword: "cedar at streamside booking faq",
            top_results: [{ title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" }],
          },
        },
      }),
    });

    const draftRes = await draftPost(draftReq, { params: { listingId: "142", slot: "2" } });
    expect(draftRes.status).toBe(202);
    const accepted = (await draftRes.json()) as JobAccepted;
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));

    expect(status.status).toBe("succeeded");
    expect(upsertAuthorityPostDraft).toHaveBeenCalledTimes(1);
    expect(persistedPost.draft_html).toContain("New grounded answer.");
    const step2 = readStep2State(persistedPost.metadata_json);
    expect(step2.draft_status).toBe("ready");
    expect(step2.draft_version).toBe(2);

    const { POST: previewPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/preview/route");
    const previewReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/preview?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "preview" }),
    });

    const previewRes = await previewPost(previewReq, { params: { listingId: "142", slot: "2" } });
    const previewJson = (await previewRes.json()) as {
      artifact?: { draft_html?: string | null; draft_version?: number };
    };

    expect(previewRes.status).toBe(200);
    expect(previewJson.artifact?.draft_html).toContain("New grounded answer.");
    expect(previewJson.artifact?.draft_version).toBe(2);
  });

  it("feeds FAQ engine dossier-enriched inputs from step2 research artifact", async () => {
    buildListingFaqSupportEngine.mockReturnValueOnce({
      publish_gate_result: { allowPublish: true, reasons: [] },
      rendered_html: "<h2>FAQ</h2><p>Dossier check.</p>",
      context: {},
      resolved_intent_clusters: [],
      candidate_questions: [],
      selected_questions: [],
      source_facts: ["source A"],
      fact_confidence_map: {},
      quality: {
        listing_specificity: 90,
        local_relevance: 90,
        directness: 90,
        factual_grounding: 90,
        selection_intent_coverage: 90,
        answer_completeness: 90,
        internal_link_quality: 90,
        generic_language_penalty: 0,
      },
    });

    const { POST: draftPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Booking FAQ for Cedar at Streamside",
        focus_topic: "faq booking questions",
        type: "contextual_guide",
        step2_contract: {
          mission_plan_slot: { slot_id: "publish_faq_support_post" },
          research_artifact: {
            focus_keyword: "cedar at streamside booking faq",
            top_results: [
              { title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" },
              { title: "Result B", url: "https://example.com/r-b", rank: 2, content_type: "comparison" },
            ],
            common_headings: ["What to know before booking"],
            common_title_patterns: ["Best booking FAQs in Vail"],
            common_user_questions: ["Do you allow early check-in?"],
            common_entities: ["parking", "pet policy"],
            common_locations: ["Vail", "CO"],
            common_decision_factors: ["cancellation"],
            content_gaps_opportunities: ["Clarify deposit policy"],
          },
        },
      }),
    });

    const draftRes = await draftPost(draftReq, { params: { listingId: "142", slot: "2" } });
    expect(draftRes.status).toBe(202);
    const accepted = (await draftRes.json()) as JobAccepted;
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");

    expect(buildListingFaqSupportEngine).toHaveBeenCalledTimes(1);
    const engineInput = buildListingFaqSupportEngine.mock.calls[0]?.[0] as { raw?: Record<string, unknown> };
    const dossier = asRecord(engineInput.raw?.research_dossier);
    const serpSummary = asRecord(dossier.serp_summary);
    const entities = asRecord(dossier.entities);

    expect(Array.isArray(serpSummary.faq_patterns) ? serpSummary.faq_patterns : []).toContain("Do you allow early check-in?");
    expect(Array.isArray(entities.location) ? entities.location : []).toContain("Vail");
    expect(Array.isArray(entities.intent) ? entities.intent : []).toContain("cancellation");
    expect(Array.isArray(dossier.serp_results) ? dossier.serp_results.length : 0).toBeGreaterThan(0);
  });

  it("prefers request research artifact over stale persisted dossier for FAQ engine input", async () => {
    persistedPost = {
      ...persistedPost,
      metadata_json: {
        ...persistedPost.metadata_json,
        step2_contract: {
          ...(asRecord(persistedPost.metadata_json.step2_contract) as Record<string, unknown>),
          research_dossier: {
            serp_summary: {
              faq_patterns: ["OLD persisted question?"],
            },
          },
        },
      },
    };
    buildListingFaqSupportEngine.mockReturnValueOnce({
      publish_gate_result: { allowPublish: true, reasons: [] },
      rendered_html: "<h2>FAQ</h2><p>Uses request artifact.</p>",
      context: {},
      resolved_intent_clusters: [],
      candidate_questions: [],
      selected_questions: [],
      source_facts: ["source A"],
      fact_confidence_map: {},
      quality: {
        listing_specificity: 90,
        local_relevance: 90,
        directness: 90,
        factual_grounding: 90,
        selection_intent_coverage: 90,
        answer_completeness: 90,
        internal_link_quality: 90,
        generic_language_penalty: 0,
      },
    });

    const { POST: draftPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Booking FAQ for Cedar at Streamside",
        focus_topic: "faq booking questions",
        type: "contextual_guide",
        step2_contract: {
          mission_plan_slot: { slot_id: "publish_faq_support_post" },
          research_artifact: {
            focus_keyword: "cedar at streamside booking faq",
            top_results: [{ title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" }],
            common_user_questions: ["NEW request question?"],
            common_locations: ["Vail"],
            common_decision_factors: ["cancellation"],
          },
        },
      }),
    });

    const draftRes = await draftPost(draftReq, { params: { listingId: "142", slot: "2" } });
    expect(draftRes.status).toBe(202);
    const accepted = (await draftRes.json()) as JobAccepted;
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");

    const engineInput = buildListingFaqSupportEngine.mock.calls[0]?.[0] as { raw?: Record<string, unknown> };
    const dossier = asRecord(engineInput.raw?.research_dossier);
    const serpSummary = asRecord(dossier.serp_summary);
    const faqPatterns = Array.isArray(serpSummary.faq_patterns) ? serpSummary.faq_patterns : [];
    expect(faqPatterns).toContain("NEW request question?");
    expect(faqPatterns).not.toContain("OLD persisted question?");
  });

  it("preserves persisted research_dossier metadata when draft request omits it", async () => {
    const persistedDossier = {
      owner_key: "site-1:142:phase1.v2",
      serp_summary: { faq_patterns: ["Persisted dossier question?"] },
    };
    persistedPost = {
      ...persistedPost,
      metadata_json: {
        ...persistedPost.metadata_json,
        step2_contract: {
          ...(asRecord(persistedPost.metadata_json.step2_contract) as Record<string, unknown>),
          research_dossier: persistedDossier,
        },
      },
    };
    buildListingFaqSupportEngine.mockReturnValueOnce({
      publish_gate_result: { allowPublish: true, reasons: [] },
      rendered_html: "<h2>FAQ</h2><p>Preserve dossier.</p>",
      context: {},
      resolved_intent_clusters: [],
      candidate_questions: [],
      selected_questions: [],
      source_facts: ["source A"],
      fact_confidence_map: {},
      quality: {
        listing_specificity: 90,
        local_relevance: 90,
        directness: 90,
        factual_grounding: 90,
        selection_intent_coverage: 90,
        answer_completeness: 90,
        internal_link_quality: 90,
        generic_language_penalty: 0,
      },
    });

    const { POST: draftPost } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const draftReq = new NextRequest("http://localhost/api/directoryiq/listings/142/authority/2/draft?site_id=site-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Booking FAQ for Cedar at Streamside",
        focus_topic: "faq booking questions",
        type: "contextual_guide",
        step2_contract: {
          mission_plan_slot: { slot_id: "publish_faq_support_post" },
          research_artifact: {
            focus_keyword: "cedar at streamside booking faq",
            top_results: [{ title: "Result A", url: "https://example.com/r-a", rank: 1, content_type: "comparison" }],
          },
        },
      }),
    });

    const draftRes = await draftPost(draftReq, { params: { listingId: "142", slot: "2" } });
    expect(draftRes.status).toBe(202);
    const accepted = (await draftRes.json()) as JobAccepted;
    const status = await waitForJobCompletion(String(accepted.statusEndpoint));
    expect(status.status).toBe("succeeded");

    const savedContract = asRecord(asRecord(persistedPost.metadata_json).step2_contract);
    const savedDossier = asRecord(savedContract.research_dossier);
    expect(savedDossier.owner_key).toBe("site-1:142:phase1.v2");
    expect(asRecord(savedDossier.serp_summary).faq_patterns).toEqual(["Persisted dossier question?"]);
  });
});
