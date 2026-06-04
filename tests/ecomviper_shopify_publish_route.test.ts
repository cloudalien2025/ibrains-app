import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as shopifyPublishRoute } from "@/app/api/ecomviper/shopify/products/publish/route";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
}));

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 29).toString("base64");

describe("Shopify guarded publish route", () => {
  beforeEach(() => {
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    delete process.env.ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_publish_attempt_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_publish_attempt_tables_checked__ = undefined;
    authMocks.requireSignedInUser.mockReset();
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_ibrains", unauthorizedResponse: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED;
  });

  it("rejects unauthenticated requests", async () => {
    authMocks.requireSignedInUser.mockResolvedValueOnce({
      userId: null,
      unauthorizedResponse: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 }),
    });

    const req = new NextRequest("http://localhost/api/ecomviper/shopify/products/publish", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await shopifyPublishRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns validation error for missing mode", async () => {
    const req = new NextRequest("http://localhost/api/ecomviper/shopify/products/publish", {
      method: "POST",
      body: JSON.stringify({
        productId: "gid://shopify/Product/770",
      }),
    });

    const response = await shopifyPublishRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("VALIDATION_ERROR");
  });

  it("runs dry-run publish with confirmation token issuance", async () => {
    const req = new NextRequest("http://localhost/api/ecomviper/shopify/products/publish", {
      method: "POST",
      body: JSON.stringify({
        mode: "dry_run",
        productId: "gid://shopify/Product/770",
        confirmationAccepted: true,
        baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
        changes: {
          title: "Updated title",
          productType: "Supplements",
        },
      }),
    });

    const response = await shopifyPublishRoute(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.publish?.status).toBe("dry_run");
    expect(payload.publish?.code).toBe("publish_intent_confirmed_dry_run");
    expect(typeof payload.publish?.confirmationToken).toBe("string");
  });
});
