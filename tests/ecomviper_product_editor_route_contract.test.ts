import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper product editor route contract", () => {
  it("exposes PDP editor route under /ecomviper/products/[productId-or-handle]", () => {
    const routePath = path.join(process.cwd(), "app/ecomviper/products/[productId-or-handle]/page.tsx");
    const clientPath = path.join(process.cwd(), "app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx");

    const routeSource = fs.readFileSync(routePath, "utf8");
    const clientSource = fs.readFileSync(clientPath, "utf8");

    expect(routeSource).toContain("buildShopifyProductEditorStateForUser");
    expect(clientSource).toContain("Products &gt;");
    expect(clientSource).toContain("Generate Intelligence");
    expect(clientSource).toContain("Product Rail");
    expect(clientSource).toContain("Trust & Compliance");
    expect(clientSource).toContain("Agentic Visibility");
    expect(clientSource).toContain("SEO & Schema");
    expect(clientSource).toContain("Commerce Intelligence");
    expect(clientSource).toContain("Shipping");
    expect(clientSource).toContain("COA");
    expect(clientSource).toContain("data-testid=\"ecomviper-product-editor-tabs\"");
  });
});
