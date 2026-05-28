import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EcomViperShopifyPage from "@/app/ecomviper/shopify/page";

describe("Shopify Agentic Commerce workspace route", () => {
  it("renders /ecomviper/shopify with live/demo status badges and without mock-first default wording", async () => {
    const element = await EcomViperShopifyPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

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

    expect(html).toContain("Shopify: Not connected");
    expect(html).toContain("OpenAI: Not connected");
    expect(html).toContain("SerpAPI: Not connected");
    expect(html).toContain("Mock mode: Off");
    expect(html).toContain("Connect required");
    expect(html.toLowerCase()).not.toContain("mock-first");
  });

  it("supports explicit demo mode when requested via query param", async () => {
    const element = await EcomViperShopifyPage({
      searchParams: Promise.resolve({ demo: "1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Environment: Demo mode");
    expect(html).toContain("Mode: Demo data (explicit mode)");
    expect(html).toContain("Mock mode: On");
  });
});
