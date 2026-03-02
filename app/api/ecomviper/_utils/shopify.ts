import crypto from "crypto";

export type ShopifyNode = Record<string, unknown>;

function sanitizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function normalizeShopDomain(input: string): string {
  const normalized = sanitizeHost(input);
  if (!normalized) {
    throw new Error("Invalid shop domain");
  }

  const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  if (!domainPattern.test(normalized)) {
    throw new Error("Invalid shop domain");
  }

  return normalized;
}

export function buildShopifyOauthHmacMessage(searchParams: URLSearchParams): string {
  const entries = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));

  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function verifyShopifyCallbackHmac(
  searchParams: URLSearchParams,
  clientSecret: string
): boolean {
  const provided = searchParams.get("hmac");
  if (!provided) return false;

  const message = buildShopifyOauthHmacMessage(searchParams);
  const digest = crypto.createHmac("sha256", clientSecret).update(message, "utf8").digest("hex");

  if (digest.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(provided, "utf8"));
}

interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeCodeForAccessToken(params: {
  shopDomain: string;
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<AccessTokenResponse> {
  const response = await fetch(`https://${params.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Shopify token exchange failed (${response.status}): ${details.slice(0, 200)}`);
  }

  const json = (await response.json()) as Partial<AccessTokenResponse>;
  if (!json.access_token) {
    throw new Error("Shopify token exchange returned no access token");
  }

  return {
    access_token: json.access_token,
    scope: json.scope ?? "",
  };
}

export interface ShopifyGraphqlPage<T> {
  nodes: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export async function graphqlAdminRequest<T>(params: {
  shopDomain: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const apiVersion = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2025-10";
  const response = await fetch(`https://${params.shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Access-Token": params.accessToken,
    },
    body: JSON.stringify({ query: params.query, variables: params.variables ?? {} }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Shopify GraphQL error (${response.status}): ${details.slice(0, 240)}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((entry) => entry.message ?? "Unknown GraphQL error").join("; "));
  }

  if (!json.data) {
    throw new Error("Shopify GraphQL response missing data");
  }

  return json.data;
}

export async function paginateGraphqlNodes<T>(params: {
  shopDomain: string;
  accessToken: string;
  query: string;
  rootField: string;
  pageSize?: number;
}): Promise<T[]> {
  const nodes: T[] = [];
  const pageSize = params.pageSize ?? 100;
  let cursor: string | null = null;

  while (true) {
    const data: Record<
      string,
      {
        edges?: Array<{ node?: T }>;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      }
    > = await graphqlAdminRequest({
      shopDomain: params.shopDomain,
      accessToken: params.accessToken,
      query: params.query,
      variables: { first: pageSize, after: cursor },
    });

    const root:
      | { edges?: Array<{ node?: T }>; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } }
      | undefined = data[params.rootField];
    const edges = root?.edges ?? [];
    for (const edge of edges) {
      if (edge.node) nodes.push(edge.node);
    }

    const hasNext = Boolean(root?.pageInfo?.hasNextPage);
    cursor = root?.pageInfo?.endCursor ?? null;
    if (!hasNext || !cursor) break;
  }

  return nodes;
}
