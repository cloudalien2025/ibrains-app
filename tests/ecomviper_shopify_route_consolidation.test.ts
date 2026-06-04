import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("ecomviper shopify route consolidation", () => {
  it("redirects /ecomviper/shopify to /ecomviper/settings", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/ecomviper/shopify/page.tsx"), "utf8");
    expect(source).toContain('redirect("/ecomviper/settings")');
    expect(source).not.toContain("Shopify Agentic Workspace");
  });
});
