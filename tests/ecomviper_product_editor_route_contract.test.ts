import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper product editor route contract", () => {
  it("exposes PDP editor route under /ecomviper/products/[productId-or-handle]", () => {
    const routePath = path.join(process.cwd(), "app/ecomviper/products/[productId-or-handle]/page.tsx");
    const clientPath = path.join(process.cwd(), "app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx");
    const galleryPath = path.join(process.cwd(), "components/ecomviper/product-image-gallery.tsx");

    const routeSource = fs.readFileSync(routePath, "utf8");
    const clientSource = fs.readFileSync(clientPath, "utf8");
    const gallerySource = fs.readFileSync(galleryPath, "utf8");

    expect(routeSource).toContain("buildShopifyProductEditorStateForUser");
    expect(clientSource).toContain("Products &gt;");
    expect(clientSource).toContain("Generate Intelligence");
    expect(clientSource).toContain("ProductImageGallery");
    expect(clientSource).toContain("orderProductImages");
    expect(gallerySource).toContain("Product Gallery");
    expect(clientSource).toContain("Product Summary");
    expect(clientSource).toContain("Trust & Compliance");
    expect(clientSource).toContain("Agentic Visibility");
    expect(clientSource).toContain("SEO & Schema");
    expect(clientSource).toContain("Shipping");
    expect(clientSource).toContain("Workspace Metadata");
    expect(clientSource).not.toContain("Product Rail");
    expect(clientSource).toContain("data-testid=\"ecomviper-product-editor-tabs\"");
    expect(clientSource).toContain("data-testid=\"ecomviper-product-hero\"");
  });
});
