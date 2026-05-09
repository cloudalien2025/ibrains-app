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
    imageStatus: "enrichment_unconfigured",
    imageStatusMessage: "Image enrichment source not configured",
    imageSource: "none",
    issues: ["Image not provided by Walmart catalog", "Image enrichment source not configured"],
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
  it("renders SKU/title/inventory/image status with deterministic recommendation sections", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[]} aiProviderConnected={false} />
    );

    expect(html).toContain("ecomviper-walmart-product-optimizer-summary");
    expect(html).toContain("30066-841");
    expect(html).toContain("Image enrichment source not configured");
    expect(html).toContain("Known (9)");
    expect(html).toContain("AI provider not configured");
    expect(html).toContain("Stage Deterministic Recommendations");
  });

  it("renders staged changes section with proposal data", () => {
    const html = renderToStaticMarkup(
      <ProductEditorClient product={createProduct()} stagedDrafts={[createStagedDraft()]} aiProviderConnected={true} />
    );

    expect(html).toContain("ecomviper-walmart-staged-changes");
    expect(html).toContain("Improved title");
    expect(html).toContain("manual_image_required");
  });
});
