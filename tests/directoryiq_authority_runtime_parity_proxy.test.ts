import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const shouldServeDirectoryIqLocally = vi.fn(() => false);
const proxyDirectoryIqRequest = vi.fn(async (_req: NextRequest, upstreamPath: string) =>
  NextResponse.json({ ok: true, upstreamPath })
);

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
});
