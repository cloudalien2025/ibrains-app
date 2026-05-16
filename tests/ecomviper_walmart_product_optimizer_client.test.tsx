import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_30066-841",
    marketplace: "walmart",
    sku: "30066-841",
    externalItemId: "wm_30066-841",
    title: "Sample Walmart Product Daily Wellness Formula with Balanced Ingredients",
    brand: "Walmart Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    imageMatchMethod: "query",
    matchedItemId: "WM-123",
    galleryImageUrls: [],
    variantImageUrls: [],
    issues: ["Image not provided by Walmart Item Search"],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-09T00:00:00.000Z",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

function createStagedDraft(): WalmartDraftRecord {
  return {
    id: "ev_draft_1",
    productId: "walmart_30066-841",
    marketplace: "walmart",
    sku: "30066-841",
    productTitle: "Sample Walmart Product",
    draftPayload: {
      title: "Improved title",
      longDescription: "Improved description",
      bulletPoints: ["One", "Two", "Three"],
      optimizerProposal: {
        id: "wm_opt_abc123",
        source: "deterministic",
        proposedTitle: "Improved title",
        proposedDescription: "Improved description",
        proposedBullets: ["One", "Two", "Three"],
        proposedKeyAttributes: { brand: "Walmart Brand" },
        proposedImageUrl: "",
        proposedImageAction: "manual_image_required",
        recommendationReason: "Catalog image missing and title needs improvement.",
        status: "staged",
      },
    },
    changeSummary: "staged proposal",
    createdBy: "tester",
    status: "draft",
    validationResult: {
      valid: true,
      warnings: [],
      suggestions: [],
    },
    publishStatus: "pending",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  };
}

describe("Walmart product optimizer client", () => {
  it("renders single-docket workflow cards with inline optimize/publish actions", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[]} aiProviderConnected={false} serpApiProviderConnected={false} />
    );

    expect(html).toContain("ecomviper-walmart-single-docket");
    expect(html).toContain("ecomviper-walmart-product-optimizer-summary");
    expect(html).toContain("ecomviper-walmart-workflow-actions");
    expect(html).toContain("ecomviper-walmart-inline-ai-panel");
    expect(html).toContain("ecomviper-walmart-draft-editor-card");
    expect(html).toContain("ecomviper-walmart-product-form");
    expect(html).toContain("ecomviper-walmart-readiness");
    expect(html).toContain("Product Editor");
    expect(html).toContain("Walmart Docket");
    expect(html).toContain("SKU: 30066-841");
    expect(html).toContain("Agentic Visibility Score");
    expect(html).toContain("View validation");
    expect(html).toContain("30066-841");
    expect(html).toContain("Inventory:</span> 9");
    expect(html).toContain("Optimize with AI");
    expect(html).toContain("Publish to Walmart");
    expect(html).toContain("Optimize updates this docket in place");
    expect(html).not.toContain("Open AI Optimizer");
    expect(html).not.toContain("/apps/ecomviper/walmart/ai-optimizer");
    expect(html).not.toContain("Preview + Validate");
    expect(html).not.toContain("Before / Original payload snapshot");
    expect(html).not.toContain("After / Normalized draft preview");
    expect(html).toContain("Validation is checked continuously and before guarded publish confirmation.");
  });

  it("renders staged changes section with proposal data", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[createStagedDraft()]} aiProviderConnected={true} serpApiProviderConnected={true} />
    );

    expect(html).toContain("ecomviper-walmart-staged-changes");
    expect(html).toContain("Improved title");
    expect(html).toContain("manual_image_required");
    expect(html).toContain("Image action: manual_image_required");
    expect(html).toContain("Approve for future submit");
  });

  it("renders Item Report reason and source text when report is the image source", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct({
          imageSource: "walmart_item_report",
          imageStatusMessage: "No matching row found in Walmart Item Report.",
          imageSyncStatus: "not_found",
          issues: ["No matching row found in Walmart Item Report."],
        })}
        stagedDrafts={[]}
        aiProviderConnected={false}
        serpApiProviderConnected={false}
      />
    );

    expect(html).toContain("Source: Walmart Item Report");
  });

  it("hydrates editable fields from normalized/raw payload and routes optimize action to current SKU", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct({
          sku: "ROC 808/NY",
          title: "",
          brand: "Unknown",
          shortDescription: "",
          longDescription: "",
          bulletPoints: [],
          normalizedPayload: {
            title: "Normalized Title from Import",
            shortDescription: "Normalized short description",
            longDescription: "Normalized long description",
            bulletPoints: ["Normalized bullet one", "Normalized bullet two"],
            imageUrl: "https://images.example.com/normalized-primary.jpg",
            galleryImageUrls: ["https://images.example.com/normalized-gallery-1.jpg"],
            brand: "Unknown",
            price: 24.5,
            inventoryQuantity: 12,
            attributes: { color: "Blue" },
          },
          rawPayload: {
            brand: "Payload Brand",
            keyFeatures: ["Payload feature one", "Payload feature two"],
          },
        })}
        stagedDrafts={[]}
        aiProviderConnected={true}
        serpApiProviderConnected={true}
      />
    );

    expect(html).toContain('value="Normalized Title from Import"');
    expect(html).toContain('>Normalized short description</textarea>');
    expect(html).toContain("Normalized bullet one");
    expect(html).toContain('value="Payload Brand"');
    expect(html).toContain("Optimize with AI");
    expect(html).not.toContain("/apps/ecomviper/walmart/ai-optimizer");
    expect(html).not.toContain(">Unknown<");
  });

  it("hydrates editable descriptions and bullets from Walmart content aliases", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct({
          shortDescription: "",
          longDescription: "",
          bulletPoints: [],
          normalizedPayload: {},
          rawPayload: {
            content: {
              siteDescription: "Alias site description from Walmart content payload",
              fullDescription: "Alias full description from Walmart content payload",
              highlights: [
                { text: "Alias highlight one" },
                { value: "Alias highlight two" },
              ],
            },
          },
        })}
        stagedDrafts={[]}
        aiProviderConnected={false}
        serpApiProviderConnected={false}
      />
    );

    expect(html).toContain(">Alias site description from Walmart content payload</textarea>");
    expect(html).toContain(">Alias full description from Walmart content payload</textarea>");
    expect(html).toContain("Alias highlight one");
    expect(html).toContain("Alias highlight two");
  });
});
