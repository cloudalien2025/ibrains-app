import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";

const getListingEvaluationMock = vi.fn();
const readPersistedStep2StateMock = vi.fn((metadata: Record<string, unknown> | null | undefined) => {
  const step2 = (metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).step2_state : {}) as Record<string, unknown>;
  return {
    draft_status: typeof step2.draft_status === "string" ? step2.draft_status : "not_started",
    image_status: typeof step2.image_status === "string" ? step2.image_status : "not_started",
    review_status: typeof step2.review_status === "string" ? step2.review_status : "not_ready",
    publish_status: typeof step2.publish_status === "string" ? step2.publish_status : "not_started",
    blog_to_listing_link_status: "not_started",
    listing_to_blog_link_status: "not_started",
    draft_version: typeof step2.draft_version === "number" ? step2.draft_version : 0,
    image_version: typeof step2.image_version === "number" ? step2.image_version : 0,
    draft_generated_at: null,
    image_generated_at: null,
    draft_last_error_code: null,
    draft_last_error_message: null,
    image_last_error_code: null,
    image_last_error_message: null,
    approved_at: null,
    approved_snapshot_draft_version: null,
    approved_snapshot_image_version: null,
    publish_attempted_at: null,
    publish_completed_at: null,
    published_post_id: null,
    published_url: null,
    publish_last_error_code: null,
    publish_last_error_message: null,
    publish_last_req_id: null,
    last_link_error_code: null,
    last_link_error_message: null,
  };
});

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation: getListingEvaluationMock,
  readPersistedStep2State: readPersistedStep2StateMock,
}));

describe("directoryiq listing detail route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    getListingEvaluationMock.mockReset();
    readPersistedStep2StateMock.mockReset();
    readPersistedStep2StateMock.mockImplementation((metadata: Record<string, unknown> | null | undefined) => {
      const step2 = (metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).step2_state : {}) as Record<string, unknown>;
      return {
        draft_status: typeof step2.draft_status === "string" ? step2.draft_status : "not_started",
        image_status: typeof step2.image_status === "string" ? step2.image_status : "not_started",
        review_status: typeof step2.review_status === "string" ? step2.review_status : "not_ready",
        publish_status: typeof step2.publish_status === "string" ? step2.publish_status : "not_started",
        blog_to_listing_link_status: "not_started",
        listing_to_blog_link_status: "not_started",
        draft_version: typeof step2.draft_version === "number" ? step2.draft_version : 0,
        image_version: typeof step2.image_version === "number" ? step2.image_version : 0,
        draft_generated_at: null,
        image_generated_at: null,
        draft_last_error_code: null,
        draft_last_error_message: null,
        image_last_error_code: null,
        image_last_error_message: null,
        approved_at: null,
        approved_snapshot_draft_version: null,
        approved_snapshot_image_version: null,
        publish_attempted_at: null,
        publish_completed_at: null,
        published_post_id: null,
        published_url: null,
        publish_last_error_code: null,
        publish_last_error_message: null,
        publish_last_req_id: null,
        last_link_error_code: null,
        last_link_error_message: null,
      };
    });
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("forwards listing detail reads to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/3?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_id).toBe("3");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/listings/3?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("normalizes upstream listing image fields to canonical mainImageUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          listing: {
            listing_id: "3",
            listing_name: "Listing 3",
            listing_url: "https://example.com/listings/3",
            main_image_url: "https://cdn.example.com/main.jpg",
            images: [{ url: "https://cdn.example.com/secondary.jpg" }],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_id).toBe("3");
    expect(json.listing.mainImageUrl).toBe("https://cdn.example.com/main.jpg");
  });

  it("normalizes canonical hero_image field to mainImageUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          listing: {
            listing_id: "3",
            listing_name: "Listing 3",
            listing_url: "https://example.com/listings/3",
            hero_image: "https://cdn.example.com/hero.jpg",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_id).toBe("3");
    expect(json.listing.mainImageUrl).toBe("https://cdn.example.com/hero.jpg");
  });

  it("normalizes listing_url from upstream permalink/profile_url fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          listing: {
            listing_id: "3",
            listing_name: "Listing 3",
            permalink: "https://example.com/listings/3",
            profile_url: "https://example.com/profile/3",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_url).toBe("https://example.com/profile/3");
  });

  it("uses canonical URL fallback fields for local detail listing_url", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
    getListingEvaluationMock.mockResolvedValue({
      listing: {
        title: "Tivoli Lodge",
        url: null,
        source_id: "site-1:651",
        raw_json: {
          listing_id: "651",
          group_name: "Tivoli Lodge",
          profile_url: "https://www.vailvacay.com/listings/tivoli-lodge",
        },
      },
      authorityPosts: [],
      evaluation: { totalScore: 77 },
    });

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/651?site_id=site-1", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req, { params: { listingId: "651" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_url).toBe("https://www.vailvacay.com/listings/tivoli-lodge");
  });

  it("keeps listing_url null when no truthful canonical URL exists in local detail payload", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
    getListingEvaluationMock.mockResolvedValue({
      listing: {
        title: "No URL Listing",
        url: null,
        source_id: "site-1:652",
        raw_json: {
          listing_id: "652",
          group_name: "No URL Listing",
        },
      },
      authorityPosts: [],
      evaluation: { totalScore: 20 },
    });

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/652?site_id=site-1", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req, { params: { listingId: "652" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_url).toBeNull();
  });

  it("forwards Cloudflare Access JWT assertion header for external auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3", {
      headers: {
        "cf-access-jwt-assertion": "test-cf-access-jwt",
      },
    });

    const res = await GET(req, { params: { listingId: "3" } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("cf-access-jwt-assertion")).toBe("test-cf-access-jwt");
  });

  it("uses canonical user id resolution when request omits x-user-id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3", {
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
      },
    });
    const expectedUserId = resolveUserId(req);

    const res = await GET(req, { params: { listingId: "3" } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe(expectedUserId);
  });

  it("returns 502 when external listing detail proxy is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("connect ETIMEDOUT");
  });

  it("returns persisted step2 snapshot and runtime stamp for local owner reads", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
    process.env.DIRECTORYIQ_RELEASE_STAMP = "rel-test-123";
    getListingEvaluationMock.mockResolvedValue({
      listing: {
        source_id: "site-1:142",
        title: "Cedar at Streamside",
        url: "https://example.com/listings/cedar-at-streamside",
        raw_json: {
          listing_id: "142",
          group_name: "Cedar at Streamside",
        },
      },
      authorityPosts: [
        {
          slot_index: 1,
          draft_html: "<p>Persisted draft</p>",
          featured_image_url: "https://example.com/image.webp",
          metadata_json: {
            step2_contract: {
              research_artifact: {
                focus_keyword: "cedar at streamside comparison",
                top_results: [{ title: "Listing", url: "https://example.com/listings/cedar-at-streamside", rank: 1 }],
              },
            },
            step2_research: { state: "ready" },
            step2_state: {
              draft_status: "ready",
              image_status: "ready",
              review_status: "ready",
              publish_status: "not_started",
              draft_version: 2,
              image_version: 1,
            },
          },
          updated_at: "2026-03-24T00:00:00.000Z",
        },
      ],
      evaluation: { totalScore: 80 },
    });

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/142?site_id=site-1", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req, { params: { listingId: "142" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.step2?.research_state).toBe("ready");
    expect(Array.isArray(json.step2?.slots)).toBe(true);
    expect(json.step2?.slots?.[0]?.draft_html).toContain("Persisted draft");
    expect(json.runtime?.runtime_owner).toBe("directoryiq-api.ibrains.ai");
    expect(json.runtime?.release_stamp).toBe("rel-test-123");
  });
});
