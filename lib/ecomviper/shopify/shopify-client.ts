import "server-only";

import { DEFAULT_SHOPIFY_API_VERSION } from "@/lib/ecomviper/shopify/shopify-types";

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

export async function runShopifyGraphqlRequest<TData>(input: {
  storeDomain: string;
  adminApiToken: string;
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
        "X-Shopify-Access-Token": input.adminApiToken,
      },
      body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Shopify request failed.";
    return {
      ok: false,
      statusCode: null,
      requestId: null,
      payload: {
        data: null,
        errors: [{ message }],
      },
      errorMessage: message,
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
    const message = `Shopify API returned invalid JSON (HTTP ${response.status}).`;
    return {
      ok: false,
      statusCode: response.status,
      requestId,
      payload: {
        data: null,
        errors: [{ message }],
      },
      errorMessage: message,
    };
  }

  const payloadRecord = asRecord(parsedPayload);
  const data = payloadRecord?.data ? (payloadRecord.data as TData) : null;
  const errors = asGraphqlErrors(payloadRecord?.errors);

  const ok = response.ok && errors.length === 0;
  const errorMessage =
    !response.ok
      ? `Shopify API request failed (HTTP ${response.status}).`
      : errors.length > 0
      ? errors[0].message
      : null;

  return {
    ok,
    statusCode: response.status,
    requestId,
    payload: {
      data,
      errors,
    },
    errorMessage,
  };
}
