import "server-only";

import crypto from "crypto";
import { runShopifyGraphqlRequest } from "@/lib/ecomviper/shopify/shopify-client";
import {
  resolveShopifyAccessTokenForUser,
  type ShopifyResolvedAccessToken,
} from "@/lib/ecomviper/shopify/shopify-connection";
import {
  getPersistedShopifyPublishAttemptByIdempotency,
  savePersistedShopifyPublishAttempt,
  type ShopifyPublishAttemptRecord,
} from "@/lib/ecomviper/shopify/shopify-product-publish-repository";

export const SHOPIFY_PUBLISH_ALLOWED_FIELDS = [
  "title",
  "descriptionHtml",
  "seoTitle",
  "seoDescription",
  "tags",
  "productType",
] as const;

type ShopifyPublishAllowedField = (typeof SHOPIFY_PUBLISH_ALLOWED_FIELDS)[number];

export type ShopifyPublishMode = "dry_run" | "execute";

export interface ShopifyPublishGuardedRequest {
  userId: string;
  mode: ShopifyPublishMode;
  productId: string;
  confirmationAccepted: boolean;
  changes: Record<string, unknown>;
  baselineUpdatedAt?: string | null;
  confirmationToken?: string | null;
  idempotencyKey?: string | null;
}

type NormalizedChanges = Partial<Record<ShopifyPublishAllowedField, string | string[]>>;

interface ConfirmationTokenPayload {
  v: "v1";
  userId: string;
  productId: string;
  fingerprint: string;
  iat: string;
  exp: string;
}

interface ShopifyProductBaselinePayload {
  product: {
    id: string;
    updatedAt: string | null;
  } | null;
}

interface ShopifyProductUpdatePayload {
  productUpdate: {
    product: {
      id: string;
      updatedAt: string | null;
      title: string | null;
      handle: string | null;
      productType: string | null;
      tags: string[] | null;
      seo: {
        title: string | null;
        description: string | null;
      } | null;
    } | null;
    userErrors: Array<{
      field?: string[];
      message: string;
    }>;
  } | null;
}

type PublishResult = {
  ok: boolean;
  status: "dry_run" | "blocked" | "executed";
  code: string;
  message: string;
  audit: Array<{ code: string; level: "info" | "warning"; message: string; occurredAt: string }>;
  confirmationToken?: string;
  confirmationTokenExpiresAt?: string;
  replayed?: boolean;
  executeEnabled?: boolean;
  allowedChanges?: NormalizedChanges;
  disallowedFields?: string[];
  stale?: {
    baselineUpdatedAt: string | null;
    currentUpdatedAt: string | null;
  };
  mutation?: {
    productId: string;
    updatedAt: string | null;
  };
};

interface ShopifyPublishServiceDeps {
  resolveAccessTokenForUser: (userId: string) => Promise<ShopifyResolvedAccessToken>;
  runGraphqlRequest: typeof runShopifyGraphqlRequest;
  getAttemptByIdempotency: typeof getPersistedShopifyPublishAttemptByIdempotency;
  saveAttempt: typeof savePersistedShopifyPublishAttempt;
  now: () => Date;
  executeEnabled: () => boolean;
}

const PRODUCT_BASELINE_QUERY = `#graphql
query ShopifyProductPublishBaseline($id: ID!) {
  product(id: $id) {
    id
    updatedAt
  }
}
`;

const PRODUCT_UPDATE_MUTATION = `#graphql
mutation ShopifyGuardedProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      updatedAt
      title
      handle
      productType
      tags
      seo {
        title
        description
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const TOKEN_TTL_MS = 10 * 60 * 1_000;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIso(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeTags(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tags = value
      .map((entry) => asString(entry))
      .filter((entry) => entry.length > 0);
    return Array.from(new Set(tags));
  }

  if (typeof value === "string") {
    const tags = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return Array.from(new Set(tags));
  }

  return null;
}

function normalizePublishChanges(input: Record<string, unknown>): {
  allowedChanges: NormalizedChanges;
  disallowedFields: string[];
} {
  const allowedChanges: NormalizedChanges = {};
  const disallowedFields: string[] = [];

  for (const [field, rawValue] of Object.entries(input)) {
    if (!SHOPIFY_PUBLISH_ALLOWED_FIELDS.includes(field as ShopifyPublishAllowedField)) {
      if (rawValue !== undefined) disallowedFields.push(field);
      continue;
    }

    if (field === "tags") {
      const tags = normalizeTags(rawValue);
      if (!tags) {
        disallowedFields.push(field);
      } else {
        allowedChanges.tags = tags;
      }
      continue;
    }

    if (typeof rawValue !== "string") {
      disallowedFields.push(field);
      continue;
    }

    const normalized = rawValue.trim();
    if (field === "title") allowedChanges.title = normalized;
    if (field === "descriptionHtml") allowedChanges.descriptionHtml = normalized;
    if (field === "seoTitle") allowedChanges.seoTitle = normalized;
    if (field === "seoDescription") allowedChanges.seoDescription = normalized;
    if (field === "productType") allowedChanges.productType = normalized;
  }

  return { allowedChanges, disallowedFields: Array.from(new Set(disallowedFields)).sort() };
}

function hasAnyAllowedChange(changes: NormalizedChanges): boolean {
  return Object.keys(changes).length > 0;
}

function buildFingerprint(input: {
  productId: string;
  baselineUpdatedAt: string | null;
  changes: NormalizedChanges;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        productId: input.productId,
        baselineUpdatedAt: input.baselineUpdatedAt,
        changes: input.changes,
      })
    )
    .digest("hex");
}

function tokenSecret(): string {
  const configured = process.env.ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY?.trim();
  return configured || "shopify-publish-local-dev-secret";
}

function signTokenPayload(payloadB64: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(payloadB64).digest("base64url");
}

function issueConfirmationToken(input: {
  userId: string;
  productId: string;
  fingerprint: string;
  now: Date;
}): { token: string; expiresAt: string } {
  const iat = input.now.toISOString();
  const exp = new Date(input.now.getTime() + TOKEN_TTL_MS).toISOString();
  const payload: ConfirmationTokenPayload = {
    v: "v1",
    userId: input.userId,
    productId: input.productId,
    fingerprint: input.fingerprint,
    iat,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signTokenPayload(payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt: exp };
}

function readConfirmationToken(input: {
  token: string;
  expectedUserId: string;
  expectedProductId: string;
  expectedFingerprint: string;
  now: Date;
}): { ok: true } | { ok: false; reason: string } {
  const token = input.token.trim();
  if (!token) return { ok: false, reason: "missing" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return { ok: false, reason: "malformed" };

  const expectedSig = signTokenPayload(payloadB64);
  const expectedBuf = Buffer.from(expectedSig);
  const providedBuf = Buffer.from(signatureB64);
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, reason: "signature" };
  }

  let parsed: ConfirmationTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ConfirmationTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (parsed.v !== "v1") return { ok: false, reason: "version" };
  if (parsed.userId !== input.expectedUserId) return { ok: false, reason: "binding_user" };
  if (parsed.productId !== input.expectedProductId) return { ok: false, reason: "binding_product" };
  if (parsed.fingerprint !== input.expectedFingerprint) return { ok: false, reason: "binding_diff" };
  const exp = Date.parse(parsed.exp);
  if (!Number.isFinite(exp) || exp <= input.now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true };
}

function hasWriteProductsScope(scopes: string[]): boolean {
  return scopes.some((scope) => scope.trim().toLowerCase() === "write_products");
}

function buildMutationInput(productId: string, changes: NormalizedChanges): Record<string, unknown> {
  const input: Record<string, unknown> = { id: productId };
  if (typeof changes.title === "string") input.title = changes.title;
  if (typeof changes.descriptionHtml === "string") input.descriptionHtml = changes.descriptionHtml;
  if (typeof changes.productType === "string") input.productType = changes.productType;
  if (Array.isArray(changes.tags)) input.tags = [...changes.tags];
  if (typeof changes.seoTitle === "string" || typeof changes.seoDescription === "string") {
    input.seo = {
      title: typeof changes.seoTitle === "string" ? changes.seoTitle : "",
      description: typeof changes.seoDescription === "string" ? changes.seoDescription : "",
    };
  }
  return input;
}

function createAuditEvent(code: string, level: "info" | "warning", message: string, now: Date) {
  return {
    code,
    level,
    message,
    occurredAt: now.toISOString(),
  };
}

function defaultDeps(): ShopifyPublishServiceDeps {
  return {
    resolveAccessTokenForUser: resolveShopifyAccessTokenForUser,
    runGraphqlRequest: runShopifyGraphqlRequest,
    getAttemptByIdempotency: getPersistedShopifyPublishAttemptByIdempotency,
    saveAttempt: savePersistedShopifyPublishAttempt,
    now: () => new Date(),
    executeEnabled: () => process.env.ECOMVIPER_SHOPIFY_PUBLISH_EXECUTE_ENABLED === "1",
  };
}

async function persistAttempt(
  deps: ShopifyPublishServiceDeps,
  input: {
    id: string;
    userId: string;
    productId: string;
    mode: ShopifyPublishMode;
    idempotencyKey: string | null;
    requestFingerprint: string;
    result: PublishResult;
    now: Date;
  }
): Promise<void> {
  const record: ShopifyPublishAttemptRecord = {
    id: input.id,
    userId: input.userId,
    productId: input.productId,
    mode: input.mode,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    outcomeStatus: input.result.status,
    outcomeCode: input.result.code,
    outcomeMessage: input.result.message,
    outcomePayload: input.result as unknown as Record<string, unknown>,
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
  };

  try {
    await deps.saveAttempt(record);
  } catch {
    // Best-effort persistence in Sprint 005.
  }
}

export async function runShopifyGuardedPublishForUser(
  input: ShopifyPublishGuardedRequest,
  overrides?: Partial<ShopifyPublishServiceDeps>
): Promise<PublishResult> {
  const deps: ShopifyPublishServiceDeps = { ...defaultDeps(), ...(overrides ?? {}) };
  const now = deps.now();
  const userId = input.userId.trim();
  const productId = input.productId.trim();
  const baselineUpdatedAt = asIso(input.baselineUpdatedAt) ?? null;
  const { allowedChanges, disallowedFields } = normalizePublishChanges(input.changes || {});
  const fingerprint = buildFingerprint({
    productId,
    baselineUpdatedAt,
    changes: allowedChanges,
  });

  if (!productId) {
    return {
      ok: false,
      status: "blocked",
      code: "invalid_product_id",
      message: "Valid Shopify product id is required.",
      audit: [createAuditEvent("publish_blocked_invalid_product_id", "warning", "Publish blocked: missing product id.", now)],
    };
  }

  if (disallowedFields.length > 0) {
    return {
      ok: false,
      status: "blocked",
      code: "field_not_allowed",
      message: "Publish blocked because one or more fields are not allowed in guarded execution.",
      disallowedFields,
      audit: [
        createAuditEvent(
          "publish_blocked_field_not_allowed",
          "warning",
          `Publish blocked for disallowed fields: ${disallowedFields.join(", ")}.`,
          now
        ),
      ],
    };
  }

  if (!input.confirmationAccepted) {
    return {
      ok: false,
      status: "blocked",
      code: "confirmation_required",
      message: "Publish confirmation is required before guarded publish review.",
      audit: [
        createAuditEvent(
          "publish_blocked_confirmation_required",
          "warning",
          "Publish request blocked because confirmation gate was not accepted.",
          now
        ),
      ],
    };
  }

  if (input.mode === "dry_run") {
    const token = issueConfirmationToken({
      userId,
      productId,
      fingerprint,
      now,
    });

    const result: PublishResult = {
      ok: true,
      status: "dry_run",
      code: "publish_intent_confirmed_dry_run",
      message: "Publish dry-run completed. No Shopify mutation was executed.",
      allowedChanges,
      confirmationToken: token.token,
      confirmationTokenExpiresAt: token.expiresAt,
      executeEnabled: deps.executeEnabled(),
      audit: [
        createAuditEvent(
          "publish_intent_confirmed_dry_run",
          "info",
          `Guarded dry-run reviewed for ${Object.keys(allowedChanges).length} allowlisted field(s).`,
          now
        ),
      ],
    };

    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "dry_run",
      idempotencyKey: null,
      requestFingerprint: fingerprint,
      result,
      now,
    });

    return result;
  }

  if (!input.confirmationToken?.trim()) {
    return {
      ok: false,
      status: "blocked",
      code: "confirmation_token_required",
      message: "Guarded execute requires a confirmation token from dry-run.",
      audit: [
        createAuditEvent(
          "publish_blocked_confirmation_token_required",
          "warning",
          "Execute request blocked because confirmation token is missing.",
          now
        ),
      ],
    };
  }

  const tokenCheck = readConfirmationToken({
    token: input.confirmationToken,
    expectedUserId: userId,
    expectedProductId: productId,
    expectedFingerprint: fingerprint,
    now,
  });
  if (!tokenCheck.ok) {
    return {
      ok: false,
      status: "blocked",
      code: "confirmation_token_invalid",
      message: "Guarded execute confirmation token is invalid, expired, or does not match the reviewed draft.",
      audit: [
        createAuditEvent(
          "publish_blocked_confirmation_token_invalid",
          "warning",
          `Execute request blocked because confirmation token validation failed (${tokenCheck.reason}).`,
          now
        ),
      ],
    };
  }

  const idempotencyKey = asString(input.idempotencyKey);
  if (!idempotencyKey) {
    return {
      ok: false,
      status: "blocked",
      code: "idempotency_key_required",
      message: "Guarded execute requires an idempotency key.",
      audit: [
        createAuditEvent(
          "publish_blocked_idempotency_key_required",
          "warning",
          "Execute request blocked because idempotency key is missing.",
          now
        ),
      ],
    };
  }

  const existing = await deps.getAttemptByIdempotency({
    userId,
    productId,
    idempotencyKey,
  });
  if (existing) {
    const replayed = existing.outcomePayload as unknown as PublishResult;
    return {
      ...replayed,
      replayed: true,
    };
  }

  if (!hasAnyAllowedChange(allowedChanges)) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "no_allowed_changes",
      message: "No allowlisted Shopify field changes were provided for execute mode.",
      allowedChanges,
      audit: [
        createAuditEvent(
          "publish_blocked_no_allowed_changes",
          "warning",
          "Execute request blocked because allowlisted change set is empty.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  let accessToken: ShopifyResolvedAccessToken;
  try {
    accessToken = await deps.resolveAccessTokenForUser(userId);
  } catch (error) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "shopify_connection_required",
      message:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Connect Shopify with required scopes before publish execution.",
      audit: [
        createAuditEvent(
          "publish_blocked_connection_required",
          "warning",
          "Execute request blocked because Shopify credentials/token are unavailable.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  if (!hasWriteProductsScope(accessToken.grantedScopes)) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "missing_write_scope",
      message: "Shopify write_products scope is required for execute mode.",
      audit: [
        createAuditEvent(
          "publish_blocked_missing_write_scope",
          "warning",
          "Execute request blocked because write_products scope is missing.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  const baselineResponse = await deps.runGraphqlRequest<ShopifyProductBaselinePayload>({
    storeDomain: accessToken.storeDomain,
    accessToken: accessToken.accessToken,
    apiVersion: accessToken.apiVersion,
    query: PRODUCT_BASELINE_QUERY,
    variables: { id: productId },
  });
  const currentUpdatedAt = asIso(baselineResponse.payload.data?.product?.updatedAt) ?? null;

  if (!baselineResponse.ok || !baselineResponse.payload.data?.product) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "stale_guard_unavailable",
      message: "Could not verify current Shopify listing baseline for guarded execute.",
      stale: {
        baselineUpdatedAt,
        currentUpdatedAt: null,
      },
      audit: [
        createAuditEvent(
          "publish_blocked_stale_guard_unavailable",
          "warning",
          "Execute request blocked because current listing baseline could not be verified.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  if (!baselineUpdatedAt || baselineUpdatedAt !== currentUpdatedAt) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "stale_listing",
      message: "Guarded execute blocked because listing baseline is stale. Re-run dry-run on latest listing snapshot.",
      stale: {
        baselineUpdatedAt,
        currentUpdatedAt,
      },
      audit: [
        createAuditEvent(
          "publish_blocked_stale_listing",
          "warning",
          "Execute request blocked because baseline updatedAt does not match current Shopify updatedAt.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  if (!deps.executeEnabled()) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "publish_execute_not_enabled",
      message: "Guarded execute scaffold validated request but live mutation is disabled in this environment.",
      allowedChanges,
      executeEnabled: false,
      stale: {
        baselineUpdatedAt,
        currentUpdatedAt,
      },
      audit: [
        createAuditEvent(
          "publish_execute_scaffold_blocked_not_enabled",
          "warning",
          "Execute scaffold reached guardrail boundary: live mutation disabled.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  const updateResponse = await deps.runGraphqlRequest<ShopifyProductUpdatePayload>({
    storeDomain: accessToken.storeDomain,
    accessToken: accessToken.accessToken,
    apiVersion: accessToken.apiVersion,
    query: PRODUCT_UPDATE_MUTATION,
    variables: {
      input: buildMutationInput(productId, allowedChanges),
    },
  });

  const userErrors = updateResponse.payload.data?.productUpdate?.userErrors ?? [];
  if (!updateResponse.ok || userErrors.length > 0 || !updateResponse.payload.data?.productUpdate?.product) {
    const result: PublishResult = {
      ok: false,
      status: "blocked",
      code: "publish_execute_failed",
      message:
        userErrors[0]?.message ||
        updateResponse.errorMessage ||
        "Shopify productUpdate failed during guarded execute.",
      audit: [
        createAuditEvent(
          "publish_execute_failed",
          "warning",
          "Guarded execute mutation failed.",
          now
        ),
      ],
    };
    await persistAttempt(deps, {
      id: crypto.randomUUID(),
      userId,
      productId,
      mode: "execute",
      idempotencyKey,
      requestFingerprint: fingerprint,
      result,
      now,
    });
    return result;
  }

  const updated = updateResponse.payload.data.productUpdate.product;
  const result: PublishResult = {
    ok: true,
    status: "executed",
    code: "publish_execute_succeeded",
    message: "Guarded execute completed for allowlisted Shopify fields.",
    allowedChanges,
    executeEnabled: true,
    mutation: {
      productId: updated.id,
      updatedAt: asIso(updated.updatedAt),
    },
    audit: [
      createAuditEvent(
        "publish_execute_succeeded",
        "info",
        "Guarded execute mutation completed successfully.",
        now
      ),
    ],
  };
  await persistAttempt(deps, {
    id: crypto.randomUUID(),
    userId,
    productId,
    mode: "execute",
    idempotencyKey,
    requestFingerprint: fingerprint,
    result,
    now,
  });
  return result;
}
