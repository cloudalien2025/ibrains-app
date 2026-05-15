import { describe, expect, it } from "vitest";
import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import { buildShopifyAgenticReadinessScore } from "@/lib/ecomviper/shopify/shopify-agentic-readiness";
import { buildShopifyStorefrontMcpEndpoints } from "@/lib/ecomviper/shopify/shopify-storefront-mcp-diagnostics";

describe("Shopify agentic readiness scoring", () => {
  it("builds expected storefront MCP endpoint URLs", () => {
    const endpoints = buildShopifyStorefrontMcpEndpoints("opanutrition.myshopify.com");

    expect(endpoints).toEqual([
      {
        id: "storefront_mcp",
        label: "Storefront MCP",
        url: "https://opanutrition.myshopify.com/api/mcp",
      },
      {
        id: "storefront_ucp_mcp",
        label: "Storefront UCP MCP",
        url: "https://opanutrition.myshopify.com/api/ucp/mcp",
      },
    ]);
  });

  it("produces deterministic readiness scores for identical inputs", () => {
    const workspace = buildShopifyAgenticDemoWorkspaceState();

    const first = buildShopifyAgenticReadinessScore({
      mcpDiagnostics: workspace.mcpDiagnostics,
      products: workspace.products,
      knowledgeBaseSummary: workspace.knowledgeBaseSummary,
      policyCoverage: workspace.policyCoverage,
      trustSignals: workspace.trustSignals,
      testQueries: workspace.testQueries,
      semanticGaps: workspace.semanticGaps,
    });

    const second = buildShopifyAgenticReadinessScore({
      mcpDiagnostics: workspace.mcpDiagnostics,
      products: workspace.products,
      knowledgeBaseSummary: workspace.knowledgeBaseSummary,
      policyCoverage: workspace.policyCoverage,
      trustSignals: workspace.trustSignals,
      testQueries: workspace.testQueries,
      semanticGaps: workspace.semanticGaps,
    });

    expect(first).toEqual(second);
    expect(first.overallValue).toBeGreaterThan(0);
    expect(first.dimensions.storefrontMcpReadiness.value).toBeGreaterThan(0);
    expect(first.dimensions.aiReferralReadiness.value).toBeGreaterThan(0);
  });
});
