import "server-only";

import {
  DEFAULT_SHOPIFY_API_VERSION,
  type ShopifyConnectionApiError,
  type ShopifyConnectionTokenStatus,
} from "@/lib/ecomviper/shopify/shopify-types";

const SHOPIFY_REQUEST_TIMEOUT_MS = 15_000;

interface ShopifyGraphqlError {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

interface ShopifyGraphqlPayload<TData> {
  data: TData | null;
  errors: ShopifyGraphqlError[];
}

export interface ShopifyTokenExchangeResult {
  ok: boolean;
  statusCode: number | null;
  requestId: string | null;
  accessToken: string | null;
  grantedScopes: string[];
  expiresIn: number | null;
  tokenExpiresAt: string | null;
  tokenStatus: ShopifyConnectionTokenStatus;
  lastApiError: ShopifyConnectionApiError | null;
  errorMessage: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function asGraphqlErrors(value: unknown): ShopifyGraphqlError[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      message: asString(entry.message) || "Shopify GraphQL error",
      path: Array.isArray(entry.path)
        ? entry.path
            .map((part) => asString(part))
            .filter((part) => part.length > 0)
        : undefined,
      extensions: asRecord(entry.extensions) ?? undefined,
    }));
}

function parseScopeList(scopeValue: string): string[] {
  if (!scopeValue) return [];
  return scopeValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toApiError(
  code: ShopifyConnectionApiError["code"],
  message: string
): ShopifyConnectionApiError {
  return { code, message };
}

function classifyTokenExchangeFailure(statusCode: number | null, payloadText: string): ShopifyConnectionApiError {
  const normalized = payloadText.toLowerCase();

  if (statusCode === 401 || statusCode === 403 || normalized.includes("invalid client")) {
    return toApiError(
      "invalid_client_credentials",
      "Shopify rejected the Client ID/Client Secret. Verify active credentials from Shopify Dev Dashboard."
    );
  }

  if (
    statusCode === 404 ||
    normalized.includes("application cannot be found") ||
    normalized.includes("app is not installed") ||
    normalized.includes("not installed")
  ) {
    return toApiError(
      "app_not_installed",
      "Shopify app is not installed on this store or application could not be found."
    );
  }

  if (normalized.includes("myshopify") || normalized.includes("shop") || normalized.includes("domain")) {
    return toApiError(
      "shop_domain_invalid",
      "Shopify store domain appears invalid. Use the store's myshopify.com domain."
    );
  }

  if (typeof statusCode === "number") {
    return toApiError(
      "token_exchange_failed",
      `Shopify token exchange failed (HTTP ${statusCode}).`
    );
  }

  return toApiError("token_exchange_failed", "Shopify token exchange failed due to a network or timeout error.");
}

export function buildShopifyGraphqlUrl(input: {
  storeDomain: string;
  apiVersion?: string | null;
}): string {
  const apiVersion = input.apiVersion?.trim() || DEFAULT_SHOPIFY_API_VERSION;
  return `https://${input.storeDomain}/admin/api/${apiVersion}/graphql.json`;
}

export function detectShopifyMissingScope(errors: ShopifyGraphqlError[]): boolean {
  const joined = errors
    .map((entry) => entry.message.toLowerCase())
    .join("\n");

  return (
    joined.includes("access denied") &&
    (joined.includes("read_products") || joined.includes("products"))
  );
}

export async function runShopifyClientCredentialsExchange(input: {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}): Promise<ShopifyTokenExchangeResult> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? SHOPIFY_REQUEST_TIMEOUT_MS);
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`https://${input.storeDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: input.clientId,
        client_secret: input.clientSecret,
      }).toString(),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutHandle);
    const lastApiError = classifyTokenExchangeFailure(null, "");
    return {
      ok: false,
      statusCode: null,
      requestId: null,
      accessToken: null,
      grantedScopes: [],
      expiresIn: null,
      tokenExpiresAt: null,
      tokenStatus: "unknown",
      lastApiError,
      errorMessage: lastApiError.message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }

  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("X-Request-Id") ??
    null;

  const raw = await response.text();
  let payload: Record<string, unknown> | null = null;
  if (raw) {
    try {
      payload = asRecord(JSON.parse(raw));
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload) {
    const lastApiError = classifyTokenExchangeFailure(response.status, raw);
    return {
      ok: false,
      statusCode: response.status,
      requestId,
      accessToken: null,
      grantedScopes: [],
      expiresIn: null,
      tokenExpiresAt: null,
      tokenStatus: "invalid",
      lastApiError,
      errorMessage: lastApiError.message,
    };
  }

  const accessToken = asString(payload.access_token);
  const grantedScopes = parseScopeList(asString(payload.scope));
  const expiresIn = asPositiveInteger(payload.expires_in);

  if (!accessToken) {
    const lastApiError = toApiError("token_exchange_failed", "Shopify token exchange response did not include an access token.");
    return {
      ok: false,
      statusCode: response.status,
      requestId,
      accessToken: null,
      grantedScopes,
      expiresIn,
      tokenExpiresAt: null,
      tokenStatus: "invalid",
      lastApiError,
      errorMessage: lastApiError.message,
    };
  }

  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1_000).toISOString() : null;

  return {
    ok: true,
    statusCode: response.status,
    requestId,
    accessToken,
    grantedScopes,
    expiresIn,
    tokenExpiresAt,
    tokenStatus: "valid",
    lastApiError: null,
    errorMessage: null,
  };
}

export async function runShopifyGraphqlRequest<TData>(input: {
  storeDomain: string;
  accessToken: string;
  apiVersion?: string | null;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  statusCode: number | null;
  requestId: string | null;
  payload: ShopifyGraphqlPayload<TData>;
  errorMessage: string | null;
  lastApiError: ShopifyConnectionApiError | null;
}> {
  const url = buildShopifyGraphqlUrl({
    storeDomain: input.storeDomain,
    apiVersion: input.apiVersion,
  });

  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? SHOPIFY_REQUEST_TIMEOUT_MS);
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": input.accessToken,
      },
      body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutHandle);
    const lastApiError = toApiError("graphql_request_failed", "Shopify API request failed due to a network or timeout error.");
    return {
      ok: false,
      statusCode: null,
      requestId: null,
      payload: {
        data: null,
        errors: [{ message: lastApiError.message }],
      },
      errorMessage: lastApiError.message,
      lastApiError,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }

  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("X-Request-Id") ??
    null;

  let parsedPayload: unknown = null;
  try {
    parsedPayload = await response.json();
  } catch {
    const lastApiError = toApiError("graphql_request_failed", `Shopify API returned invalid JSON (HTTP ${response.status}).`);
    return {
      ok: false,
      statusCode: response.status,
      requestId,
      payload: {
        data: null,
        errors: [{ message: lastApiError.message }],
      },
      errorMessage: lastApiError.message,
      lastApiError,
    };
  }

  const payloadRecord = asRecord(parsedPayload);
  const data = payloadRecord?.data ? (payloadRecord.data as TData) : null;
  const errors = asGraphqlErrors(payloadRecord?.errors);

  const missingScope = detectShopifyMissingScope(errors);
  const ok = response.ok && errors.length === 0;
  let lastApiError: ShopifyConnectionApiError | null = null;
  let errorMessage: string | null = null;

  if (!response.ok) {
    errorMessage = `Shopify API request failed (HTTP ${response.status}).`;
    lastApiError = toApiError("graphql_request_failed", errorMessage);
  } else if (errors.length > 0) {
    errorMessage = errors[0].message;
    if (missingScope) {
      lastApiError = toApiError("insufficient_scope", "Shopify token is missing required scope: read_products.");
    } else {
      lastApiError = toApiError("graphql_request_failed", errorMessage);
    }
  }

  return {
    ok,
    statusCode: response.status,
    requestId,
    payload: {
      data,
      errors,
    },
    errorMessage,
    lastApiError,
  };
}
