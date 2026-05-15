import { normalizeShopifyStoreDomain } from "@/lib/ecomviper/shopify/shopify-domain";
import type {
  ShopifyMcpDiagnosticResult,
  ShopifyMcpDiagnosticStatus,
  ShopifyStorefrontMcpEndpoint,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

function isoNow(): string {
  return new Date().toISOString();
}

function safeStoreDomain(input: string): string {
  return normalizeShopifyStoreDomain(input) ?? "opanutrition.myshopify.com";
}

export function buildShopifyStorefrontMcpEndpoints(storeDomain: string): ShopifyStorefrontMcpEndpoint[] {
  const normalizedStoreDomain = safeStoreDomain(storeDomain);
  return [
    {
      id: "storefront_mcp",
      label: "Storefront MCP",
      url: `https://${normalizedStoreDomain}/api/mcp`,
    },
    {
      id: "storefront_ucp_mcp",
      label: "Storefront UCP MCP",
      url: `https://${normalizedStoreDomain}/api/ucp/mcp`,
    },
  ];
}

function statusMessage(status: ShopifyMcpDiagnosticStatus): string {
  if (status === "reachable") return "Endpoint responded to a safe probe.";
  if (status === "mock_ready") return "Mock diagnostics ready for dashboard workflows.";
  if (status === "needs_credentials") return "Endpoint requires credentials or app installation.";
  if (status === "failed") return "Endpoint probe failed or timed out.";
  return "Endpoint is not configured for this workspace yet.";
}

export function buildMockShopifyMcpDiagnostics(input: {
  storeDomain: string;
  statusByEndpoint?: Partial<Record<ShopifyStorefrontMcpEndpoint["id"], ShopifyMcpDiagnosticStatus>>;
}): ShopifyMcpDiagnosticResult[] {
  const endpoints = buildShopifyStorefrontMcpEndpoints(input.storeDomain);

  return endpoints.map((endpoint) => {
    const status =
      input.statusByEndpoint?.[endpoint.id] ??
      (endpoint.id === "storefront_mcp" ? "mock_ready" : "not_configured");

    return {
      endpoint,
      status,
      checkedAt: isoNow(),
      message: statusMessage(status),
      latencyMs: status === "reachable" ? 142 : null,
      source: "mock",
    };
  });
}

export async function runShopifyMcpDiagnostics(input: {
  storeDomain: string;
  enableLiveProbe?: boolean;
  requestTimeoutMs?: number;
}): Promise<ShopifyMcpDiagnosticResult[]> {
  if (!input.enableLiveProbe) {
    return buildMockShopifyMcpDiagnostics({ storeDomain: input.storeDomain });
  }

  const endpoints = buildShopifyStorefrontMcpEndpoints(input.storeDomain);
  const timeoutMs = Math.max(1000, input.requestTimeoutMs ?? 2500);

  const diagnostics = await Promise.all(
    endpoints.map(async (endpoint) => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const startedAt = Date.now();
        const response = await fetch(endpoint.url, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const latencyMs = Date.now() - startedAt;
        const status: ShopifyMcpDiagnosticStatus =
          response.status >= 200 && response.status < 300
            ? "reachable"
            : response.status === 401 || response.status === 403
              ? "needs_credentials"
              : "failed";

        return {
          endpoint,
          status,
          checkedAt: isoNow(),
          message: statusMessage(status),
          latencyMs,
          source: "live" as const,
        };
      } catch {
        const status: ShopifyMcpDiagnosticStatus = "failed";
        return {
          endpoint,
          status,
          checkedAt: isoNow(),
          message: statusMessage(status),
          latencyMs: null,
          source: "live" as const,
        };
      } finally {
        clearTimeout(timeoutHandle);
      }
    })
  );

  return diagnostics;
}
