import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import EcomViperHubPage from "@/app/ecomviper/hub/page";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

describe("EcomViper Hub Feed Control Center foundation", () => {
  it("renders static marketplace feed sources for Walmart, eBay, Amazon, and Shopify", () => {
    const html = renderToStaticMarkup(EcomViperHubPage());

    expect(html).toContain("ecomviper-hub-feed-control-center");
    expect(html).toContain("Feed Control Center");
    expect(html).toContain("EcomViper/Walmart");
    expect(html).toContain("EcomViper/eBay");
    expect(html).toContain("EcomViper/Amazon");
    expect(html).toContain("EcomViper/Shopify");
    expect(html).toContain("/optiwal");
    expect(html).toContain("/optibay");
    expect(html).toContain("/optizon");
    expect(html).toContain("/ecomviper/shopify");
  });

  it("communicates intake, canonicalization, and publication-readiness as static foundation only", () => {
    const html = renderToStaticMarkup(EcomViperHubPage());

    expect(html).toContain("Canonicalization Queue Preview");
    expect(html).toContain("Publication Readiness Preview");
    expect(html).toContain("no live sync");
    expect(html).toContain("marketplace APIs");
    expect(html).toContain("No public routes are implemented in this sprint");
    expect(html).toContain("preferred public discovery surface at ecomviper.com");
  });
});
