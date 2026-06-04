import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runShopifyGuardedPublishForUser } from "@/lib/ecomviper/shopify/shopify-product-publish-service";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 27).toString("base64");

describe("Shopify guarded publish service", () => {
  beforeEach(() => {
    process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    delete process.env.ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_publish_attempt_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_shopify_publish_attempt_tables_checked__ = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED;
  });

  it("blocks dry-run when confirmation gate is missing", async () => {
    const result = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "dry_run",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: false,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(result.status).toBe("blocked");
    expect(result.code).toBe("confirmation_required");
  });

  it("enforces strict field allowlist for publish changes", async () => {
    const result = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "dry_run",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      changes: {
        title: "Updated title",
        inventoryQuantity: 45,
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(result.status).toBe("blocked");
    expect(result.code).toBe("field_not_allowed");
    expect(result.disallowedFields).toEqual(["inventoryQuantity"]);
  });

  it("requires confirmation token for execute mode", async () => {
    const result = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "execute",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
      idempotencyKey: "idem_001",
    });

    expect(result.status).toBe("blocked");
    expect(result.code).toBe("confirmation_token_required");
  });

  it("requires idempotency key for execute mode", async () => {
    const dryRun = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "dry_run",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(dryRun.status).toBe("dry_run");
    expect(typeof dryRun.confirmationToken).toBe("string");

    const execute = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "execute",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      confirmationToken: dryRun.confirmationToken,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    expect(execute.status).toBe("blocked");
    expect(execute.code).toBe("idempotency_key_required");
  });

  it("blocks execute when optimistic concurrency baseline is stale", async () => {
    const runGraphqlRequest = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        requestId: "req_publish_baseline_1",
        errorMessage: null,
        lastApiError: null,
        payload: {
          data: {
            product: {
              id: "gid://shopify/Product/770",
              updatedAt: "2026-05-18T00:05:00.000Z",
            },
          },
          errors: [],
        },
      });

    const dryRun = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "dry_run",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    const execute = await runShopifyGuardedPublishForUser(
      {
        userId: "user_ibrains",
        mode: "execute",
        productId: "gid://shopify/Product/770",
        confirmationAccepted: true,
        confirmationToken: dryRun.confirmationToken,
        idempotencyKey: "idem_stale_1",
        changes: {
          title: "Updated title",
        },
        baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
      },
      {
        resolveAccessTokenForUser: vi.fn().mockResolvedValue({
          authMode: "dev_dashboard_client_credentials",
          storeDomain: "opanutrition.myshopify.com",
          apiVersion: "2025-10",
          accessToken: "token_1",
          tokenExpiresAt: null,
          grantedScopes: ["read_products", "write_products"],
        }),
        runGraphqlRequest: runGraphqlRequest as unknown as typeof import("@/lib/ecomviper/shopify/shopify-client").runShopifyGraphqlRequest,
      }
    );

    expect(execute.status).toBe("blocked");
    expect(execute.code).toBe("stale_listing");
  });

  it("replays execute result by idempotency key without duplicate baseline fetch", async () => {
    const runGraphqlRequest = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        requestId: "req_publish_baseline_2",
        errorMessage: null,
        lastApiError: null,
        payload: {
          data: {
            product: {
              id: "gid://shopify/Product/770",
              updatedAt: "2026-05-18T00:00:00.000Z",
            },
          },
          errors: [],
        },
      });

    const dryRun = await runShopifyGuardedPublishForUser({
      userId: "user_ibrains",
      mode: "dry_run",
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    });

    const executeInput = {
      userId: "user_ibrains",
      mode: "execute" as const,
      productId: "gid://shopify/Product/770",
      confirmationAccepted: true,
      confirmationToken: dryRun.confirmationToken,
      idempotencyKey: "idem_replay_1",
      changes: {
        title: "Updated title",
      },
      baselineUpdatedAt: "2026-05-18T00:00:00.000Z",
    };

    const overrides = {
      resolveAccessTokenForUser: vi.fn().mockResolvedValue({
        authMode: "dev_dashboard_client_credentials",
        storeDomain: "opanutrition.myshopify.com",
        apiVersion: "2025-10",
        accessToken: "token_1",
        tokenExpiresAt: null,
        grantedScopes: ["read_products", "write_products"],
      }),
      runGraphqlRequest: runGraphqlRequest as unknown as typeof import("@/lib/ecomviper/shopify/shopify-client").runShopifyGraphqlRequest,
    };

    const first = await runShopifyGuardedPublishForUser(executeInput, overrides);
    const second = await runShopifyGuardedPublishForUser(executeInput, overrides);

    expect(first.code).toBe("publish_execute_not_enabled");
    expect(second.code).toBe("publish_execute_not_enabled");
    expect(second.replayed).toBe(true);
    expect(runGraphqlRequest).toHaveBeenCalledTimes(1);
  });
});
