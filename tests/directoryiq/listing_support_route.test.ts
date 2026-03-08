import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const resolveListingEvaluation = vi.fn(async () => ({
  siteId: "site-1",
  listingEval: {
    listing: { source_id: "listing-1", title: "Listing One", url: "https://example.com/listing-1" },
    evaluation: { totalScore: 0 },
  },
}));
const getListingCurrentSupport = vi.fn(async () => ({
  listing: { id: "listing-1", title: "Listing One", canonicalUrl: "https://example.com/listing-1", siteId: "site-1" },
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

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation,
  ListingSiteRequiredError: class ListingSiteRequiredError extends Error {},
}));

vi.mock("@/src/directoryiq/services/listingSupportService", () => ({
  getListingCurrentSupport: (...args: unknown[]) => getListingCurrentSupport(...args),
}));

describe("directoryiq listing support route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty support arrays without crashing", async () => {
    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/listing-1/support");
    const res = await GET(req, { params: { listingId: "listing-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.support.inboundLinkedSupport).toHaveLength(0);
    expect(json.support.mentionsWithoutLinks).toHaveLength(0);
    expect(json.support.outboundSupportLinks).toHaveLength(0);
    expect(json.support.connectedSupportPages).toHaveLength(0);
  });
});
