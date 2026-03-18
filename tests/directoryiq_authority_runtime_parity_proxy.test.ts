import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const shouldServeDirectoryIqLocally = vi.fn(() => false);
const proxyDirectoryIqRequest = vi.fn(async (_req: NextRequest, upstreamPath: string) =>
  NextResponse.json({ ok: true, upstreamPath })
);
const getDirectoryIqOpenAiKey = vi.fn(async () => "sk-test");
const upsertAuthorityPostDraft = vi.fn(async () => {});
const normalizePostType = vi.fn(() => "local_guide");
const normalizeSlot = vi.fn(() => 1);
const buildGovernedPrompt = vi.fn(() => "prompt");
const ensureContextualListingLink = vi.fn((input: { html: string }) => input.html);
const validateDraftHtml = vi.fn(() => ({ valid: true, hasContextualListingLink: true, errors: [] as string[] }));
const generateAuthorityDraft = vi.fn(async () => "<p>draft</p><a href=\"https://example.com/listings/acme\">link</a>");
const validateOpenAiKeyPresent = vi.fn((value: string) => value);
const resolveListingEvaluation = vi.fn(async () => ({
  listingEval: {
    listing: {
      source_id: "listing-source-1",
      title: "Acme",
      url: "https://example.com/listings/acme",
      raw_json: { description: "desc" },
    },
  },
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally,
}));

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  getDirectoryIqOpenAiKey,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  upsertAuthorityPostDraft,
}));

vi.mock("@/app/api/directoryiq/_utils/authority", () => ({
  normalizePostType,
  normalizeSlot,
}));

vi.mock("@/lib/directoryiq/contentGovernance", () => ({
  buildGovernedPrompt,
  ensureContextualListingLink,
  validateDraftHtml,
}));

vi.mock("@/lib/openai/serverClient", () => ({
  generateAuthorityDraft,
  validateOpenAiKeyPresent,
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation,
  ListingSiteRequiredError: class ListingSiteRequiredError extends Error {},
}));

describe("directoryiq authority runtime parity proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldServeDirectoryIqLocally.mockReturnValue(false);
  });

  it("proxies draft and image routes when request host is not DirectoryIQ API host", async () => {
    const draftRoute = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");
    const imageRoute = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/image/route");

    const draftReq = new NextRequest("https://app.ibrains.ai/api/directoryiq/listings/3/authority/1/draft?site_id=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ focus_topic: "topic" }),
    });
    const imageReq = new NextRequest("https://app.ibrains.ai/api/directoryiq/listings/3/authority/1/image?site_id=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ focus_topic: "topic" }),
    });

    const draftRes = await draftRoute.POST(draftReq, { params: { listingId: "3", slot: "1" } });
    const imageRes = await imageRoute.POST(imageReq, { params: { listingId: "3", slot: "1" } });

    expect(draftRes.status).toBe(200);
    expect(imageRes.status).toBe(200);
    expect(proxyDirectoryIqRequest).toHaveBeenCalledTimes(2);
    expect(proxyDirectoryIqRequest).toHaveBeenNthCalledWith(
      1,
      draftReq,
      "/api/directoryiq/listings/3/authority/1/draft",
      "POST"
    );
    expect(proxyDirectoryIqRequest).toHaveBeenNthCalledWith(
      2,
      imageReq,
      "/api/directoryiq/listings/3/authority/1/image",
      "POST"
    );
    expect(ensureUser).not.toHaveBeenCalled();
  });

  it("serves draft locally when step2_writer=1 even if host mismatches", async () => {
    const draftRoute = await import("@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route");

    const draftReq = new NextRequest(
      "https://app.ibrains.ai/api/directoryiq/listings/3/authority/1/draft?site_id=s1&step2_writer=1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "local_guide", focus_topic: "topic", title: "title" }),
      }
    );

    const draftRes = await draftRoute.POST(draftReq, { params: { listingId: "3", slot: "1" } });
    const json = await draftRes.json();

    expect(draftRes.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(proxyDirectoryIqRequest).not.toHaveBeenCalled();
    expect(ensureUser).toHaveBeenCalled();
    expect(upsertAuthorityPostDraft).toHaveBeenCalled();
  });
});
