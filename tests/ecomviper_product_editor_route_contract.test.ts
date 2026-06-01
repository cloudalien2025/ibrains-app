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
    expect(clientSource).toContain("ecomviper-product-hero");
    expect(clientSource).toContain("ecomviper-product-edit-area");
    expect(clientSource).toContain("ecomviper-product-editor-actions");
    expect(clientSource).toContain("Generate Intelligence");
    expect(clientSource).toContain("Save Changes");
    expect(clientSource).toContain("Publish");
    expect(clientSource).not.toContain("Preview PDP");
    expect(clientSource).toContain("ProductImageGallery");
    expect(clientSource).toContain("orderProductImages");
    expect(gallerySource).toContain("Product Gallery");
    expect(gallerySource).toContain("Add from Image Studio (Coming soon)");
    expect(clientSource).toContain("Product Summary");
    expect(clientSource).toContain("Trust & Compliance");
    expect(clientSource).toContain("Agentic Visibility");
    expect(clientSource).toContain("SEO & Schema");
    expect(clientSource).toContain("Shipping");
    expect(clientSource).not.toContain("Workspace Metadata");
    expect(clientSource).not.toContain("Product Rail");
    expect(clientSource).toContain("data-testid=\"ecomviper-product-editor-tabs\"");
    expect(clientSource).toContain("ecomviper.com when the publishing backend is enabled");
  });

  it("removes duplicate /ecomviper/shopify/products/[productId-or-handle] route globally", () => {
    const duplicateRoutePath = path.join(
      process.cwd(),
      "app/ecomviper/shopify/products/[productId-or-handle]/page.tsx"
    );
    const duplicateClientPath = path.join(
      process.cwd(),
      "app/ecomviper/shopify/products/[productId-or-handle]/shopify-product-editor-client.tsx"
    );
    const shopifyWorkspacePath = path.join(process.cwd(), "app/ecomviper/shopify/shopify-workspace-client.tsx");
    const canonicalPagePath = path.join(process.cwd(), "app/ecomviper/products/[productId-or-handle]/page.tsx");
    const canonicalClientPath = path.join(
      process.cwd(),
      "app/ecomviper/products/[productId-or-handle]/product-editor-client.tsx"
    );
    const imageSelectionHelperPath = path.join(
      process.cwd(),
      "lib/ecomviper/shopify/product-image-selection.ts"
    );

    expect(fs.existsSync(duplicateRoutePath)).toBe(false);
    expect(fs.existsSync(duplicateClientPath)).toBe(false);

    const shopifyWorkspaceSource = fs.readFileSync(shopifyWorkspacePath, "utf8");
    const canonicalPageSource = fs.readFileSync(canonicalPagePath, "utf8");
    const canonicalClientSource = fs.readFileSync(canonicalClientPath, "utf8");
    const imageSelectionSource = fs.readFileSync(imageSelectionHelperPath, "utf8");

    expect(shopifyWorkspaceSource).toContain("/ecomviper/products/");
    expect(shopifyWorkspaceSource).not.toContain("/ecomviper/shopify/products/");
    expect(canonicalPageSource).not.toContain("ROC948");
    expect(canonicalClientSource).not.toContain("ROC948");
    expect(imageSelectionSource).not.toContain("ROC123");
    expect(imageSelectionSource).not.toContain("ROC948");
    expect(imageSelectionSource).not.toContain("opa-oxy-burn-thermogenic-support");
  });
});
