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
  it("renders guided workflow cards with one clear AI-first action path", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[]} aiProviderConnected={false} />
    );

    expect(html).toContain("ecomviper-walmart-workflow-steps");
    expect(html).toContain("ecomviper-walmart-product-optimizer-summary");
    expect(html).toContain("ecomviper-walmart-primary-actions");
    expect(html).toContain("ecomviper-walmart-inline-ai-panel");
    expect(html).toContain("ecomviper-walmart-draft-editor-card");
    expect(html).toContain("ecomviper-walmart-product-form");
    expect(html).toContain("ecomviper-walmart-readiness");
    expect(html).toContain("Product Editor");
    expect(html).toContain("1 Review");
    expect(html).toContain("2 Improve");
    expect(html).toContain("3 Submit");
    expect(html).toContain("SKU: 30066-841");
    expect(html).toContain("Top issues");
    expect(html).toContain("View all issues");
    expect(html).toContain("30066-841");
    expect(html).toContain("Known (9)");
    expect(html).toContain("Generate AI Improvements");
    expect(html).toContain(
      "Optimize title, descriptions, bullets, and attributes without leaving this page."
    );
    expect(html).toContain("Improve this listing with AI");
    expect(html).toContain("Rule-based suggestions");
    expect(html).toContain("No auto-submit. Changes remain in draft until approved.");
    expect(html).toContain("Stage rule-based suggestions");
    expect(html).not.toContain("Open AI Optimizer");
    expect(html).not.toContain("/apps/ecomviper/walmart/ai-optimizer");
    expect(html).not.toContain("Preview + Validate");
    expect(html).not.toContain("Before / Original payload snapshot");
    expect(html).not.toContain("After / Normalized draft preview");
    expect(html).toContain("Validation is checked continuously and before Submit Update.");
  });

  it("renders staged changes section with proposal data", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[createStagedDraft()]} aiProviderConnected={true} />
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
      />
    );

    expect(html).toContain("No matching row found in Walmart Item Report.");
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
      />
    );

    expect(html).toContain('value="Normalized Title from Import"');
    expect(html).toContain('>Normalized short description</textarea>');
    expect(html).toContain("Normalized bullet one");
    expect(html).toContain('value="Payload Brand"');
    expect(html).toContain("Improve this listing with AI");
    expect(html).not.toContain("/apps/ecomviper/walmart/ai-optimizer");
    expect(html).not.toContain(">Unknown<");
  });
});
