// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc949",
    marketplace: "walmart",
    sku: "ROC949",
    externalItemId: "wm_roc949",
    title: "OPA Joint Platinum",
    brand: "OPA",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 12,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: ["Image not provided by Walmart Item Search"],
    attributes: { form: "Capsule", serving_size: "2 capsules" },
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function createDraft(): WalmartDraftRecord {
  return {
    id: "ev_draft_searchbrowse",
    productId: "walmart_roc949",
    marketplace: "walmart",
    sku: "ROC949",
    productTitle: "OPA Joint Platinum",
    draftPayload: {
      title: "OPA Joint Platinum",
      price: 29.99,
      inventoryQuantity: 12,
      searchBrowseAttributes: {
        age_group: "Adult",
        product_form: "Capsule",
        support_areas: "Joint comfort, mobility",
      },
      faqSnippets: [
        "Q: What is this product? A: A supplement for daily wellness support.",
        "Q: How do I take it? A: Use as directed on label.",
      ],
    },
    changeSummary: "search browse staged",
    createdBy: "tester",
    status: "validated",
    validationResult: {
      valid: true,
      warnings: [],
      suggestions: [],
    },
    publishStatus: "pending",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
  };
}

describe("Walmart Search & Browse editor hydration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("hydrates Search & Browse values and persists them on Save Draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          draft: {
            updatedAt: "2026-05-10T00:00:00.000Z",
            validationResult: { valid: true, violations: [], warnings: [], suggestions: [] },
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[createDraft()]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    expect(container.textContent).toContain("Search & Browse");
    expect(container.textContent).toContain("Image-derived facts status: unknown");
    expect(container.innerHTML).toContain("Joint comfort, mobility");
    expect(
      container.querySelector('[data-testid="ecomviper-walmart-search-browse-section"]')
    ).not.toBeNull();

    expect(container.querySelector('[data-testid="ecomviper-walmart-faq-section"]')).not.toBeNull();
    const faqTextarea = container.querySelector(
      '[data-testid="ecomviper-walmart-faq-textarea"]'
    ) as HTMLTextAreaElement;
    expect(faqTextarea).not.toBeNull();
    expect(faqTextarea.value).toContain("Q: What is this product?");

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { draftPayload: Record<string, unknown> };

    expect(body.draftPayload.searchBrowseAttributes).toMatchObject({
      age_group: "Adult",
      product_form: "Capsule",
      support_areas: "Joint comfort, mobility",
    });
    expect(body.draftPayload.attributes).toMatchObject({
      product_form: "Capsule",
      support_areas: "Joint comfort, mobility",
    });
    expect(body.draftPayload.faqSnippets).toEqual([
      "Q: What is this product? A: A supplement for daily wellness support.",
      "Q: How do I take it? A: Use as directed on label.",
    ]);
  });
});
