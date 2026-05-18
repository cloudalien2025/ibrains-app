import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const { productAiVisibilityDiagnosticsMock } = vi.hoisted(() => ({
  productAiVisibilityDiagnosticsMock: vi.fn(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/lib/ecomviper/walmart/walmart-product-ai-visibility-score", () => ({
  buildWalmartProductAiVisibilityDiagnostics: productAiVisibilityDiagnosticsMock,
}));

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

describe("Walmart product editor score alignment", () => {
  it("renders Agentic Visibility ring from canonical product ai visibility adapter output", () => {
    productAiVisibilityDiagnosticsMock.mockReset();
    productAiVisibilityDiagnosticsMock.mockReturnValue({
      ai_visibility_score: {
        overall: 33,
        status: "critical",
        dimensions: {
          catalog_readiness_coverage: 33,
        },
        provenance: {
          source: "derived",
          generated_at: "2026-05-18T00:00:00.000Z",
          input_refs: ["tests/ecomviper_walmart_product_editor_score_alignment.test.tsx"],
        },
        recommendations: [],
      },
      listing_quality_score: 33,
      projected_listing_quality_score: null,
    });

    const html = renderToStaticMarkup(
      <ProductEditorClient
        product={createProduct()}
        stagedDrafts={[] as WalmartDraftRecord[]}
        aiProviderConnected={false}
        serpApiProviderConnected={false}
      />
    );

    expect(productAiVisibilityDiagnosticsMock).toHaveBeenCalled();
    expect(html).toContain("Agentic Visibility Score");
    expect(html).toContain("Current 33%");
    expect(html).toContain("aria-label=\"Agentic Visibility Score 33% (Poor)\"");
  });
});
