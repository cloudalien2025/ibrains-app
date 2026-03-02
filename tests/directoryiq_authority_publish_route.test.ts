import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

const makeVersionLabel = vi.fn(() => "BLOG-v1");
const normalizeSlot = vi.fn(() => 1);
const verifyApprovalToken = vi.fn(() => ({ ok: true }));

const getListingEvaluation = vi.fn(async () => ({
  listing: { source_id: "321", title: "Fixture", raw_json: {} },
  evaluation: { totalScore: 70, scores: { structure: 70, clarity: 70, trust: 70, authority: 70, actionability: 70 } },
}));
const getAuthorityPostBySlot = vi.fn(async () => ({
  id: "post-1",
  title: "Fixture post",
  draft_html: "<p>draft</p>",
  featured_image_url: null,
  blog_to_listing_link_status: "linked",
  listing_to_blog_link_status: "missing",
}));
const markPostPublished = vi.fn(async () => {});
const addDirectoryIqVersion = vi.fn(async () => "v1");

const getDirectoryIqBdConnection = vi.fn(async () => ({
  baseUrl: "https://example.com",
  apiKey: "key",
  dataPostsCreatePath: "/api/v2/data_posts/create",
  blogDataId: 77,
  dataPostsSearchPath: "/api/v2/data_posts/search",
  listingsDataId: 75,
  dataPostsUpdatePath: "/api/v2/data_posts/update",
}));
const publishBlogPostToBd = vi.fn(async () => ({ ok: true, status: 200, body: { post_id: "987", url: "https://example.com/blog/987" } }));
const resolveTruePostIdForListing = vi.fn(async () => ({ truePostId: "123", mappingKey: "slug" as const }));
const pushListingUpdateToBd = vi.fn(async () => ({ ok: true, status: 200, body: { ok: true } }));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({ ensureUser, resolveUserId }));
vi.mock("@/app/api/directoryiq/_utils/authority", () => ({ makeVersionLabel, normalizeSlot, verifyApprovalToken }));
vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  addDirectoryIqVersion,
  getAuthorityPostBySlot,
  getListingEvaluation,
  markPostPublished,
}));
vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqBdConnection,
  publishBlogPostToBd,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
}));

describe("directoryiq authority publish route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires explicit approval before publish", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish", {
      method: "POST",
      body: JSON.stringify({ approval_token: "token-1" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("APPROVAL_REQUIRED");
    expect(typeof json.error.reqId).toBe("string");
    expect(publishBlogPostToBd).not.toHaveBeenCalled();
  });

  it("publishes when approved=true", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/publish/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/authority/1/publish", {
      method: "POST",
      body: JSON.stringify({ approved: true, approval_token: "token-1" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ listingId: "321", slot: "1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(publishBlogPostToBd).toHaveBeenCalledTimes(1);
    expect(pushListingUpdateToBd).toHaveBeenCalledTimes(1);
    expect(markPostPublished).toHaveBeenCalledTimes(1);
  });
});
