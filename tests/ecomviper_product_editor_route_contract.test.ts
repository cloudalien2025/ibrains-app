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
    expect(clientSource).toContain("Shopify Product Data");
    expect(clientSource).toContain("Supplier Intelligence");
    expect(clientSource).toContain("Match confidence");
    expect(clientSource).toContain("COA status");
    expect(clientSource).toContain("AI PDP Optimizer");
    expect(clientSource).toContain("Image Studio");
    expect(clientSource).toContain("Buy Now Links");
    expect(clientSource).toContain("Publish Controls");
  });
});
