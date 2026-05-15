import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EcomViperShopifyPage from "@/app/apps/ecomviper/shopify/page";

describe("Shopify Agentic Commerce workspace route", () => {
  it("renders /apps/ecomviper/shopify with sidebar and command center sections", () => {
    const html = renderToStaticMarkup(<EcomViperShopifyPage />);

    expect(html).toContain("ecomviper-shopify-workspace");
    expect(html).toContain("Shopify Agentic Workspace");
    expect(html).toContain("SHOPIFY AGENTIC COMMERCE");
    expect(html).toContain("Agentic Commerce Command Center");

    expect(html).toContain("ecomviper-shopify-sidebar");
    expect(html).toContain(">Command Center<");
    expect(html).toContain(">Products<");
    expect(html).toContain(">Knowledge Base<");
    expect(html).toContain(">Prompt Match<");
    expect(html).toContain(">Trust Signals<");
    expect(html).toContain(">Semantic Gaps<");
    expect(html).toContain(">Product Opportunities<");
    expect(html).toContain(">Marketplace Health<");
    expect(html).toContain(">Settings<");

    expect(html).toContain("Shopify Agentic Readiness Summary");
    expect(html).toContain("Storefront MCP Connection");
    expect(html).toContain("Knowledge Base Coverage");
    expect(html).toContain("AI Test Queries");
    expect(html).toContain("Next Best Actions");

    expect(html).toContain("Environment: Demo / Production-safe");
    expect(html).toContain("Store: opanutrition.myshopify.com");
    expect(html).toContain("Mode: Mock-first / BYO credentials");
  });
});
