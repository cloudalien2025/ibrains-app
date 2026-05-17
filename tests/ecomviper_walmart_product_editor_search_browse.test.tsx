// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import { createEmptyWalmartDocket } from "@/lib/ecomviper/walmart/walmart-docket";
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
    expect(container.textContent).toContain("Field provenance");
    expect(container.innerHTML).toContain("Joint comfort, mobility");
    expect(container.innerHTML).toContain('value="Unflavored"');
    expect(
      container.querySelector('[data-testid="ecomviper-walmart-search-browse-section"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ecomviper-walmart-field-provenance-table"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-faq-section"]')).toBeNull();

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

  it("renders imported normalized docket values without requiring live refresh", async () => {
    const docket = createEmptyWalmartDocket({
      sku: "ROC949",
      statuses: ["imported_docket_ready", "report_backfill_pending"],
    });
    docket.content.shortDescription.value = "Docket short description";
    docket.content.longDescription.value = "Docket long description";
    docket.content.bullets.value = ["Docket bullet one", "Docket bullet two"];
    docket.content.brand.value = "Docket Brand";
    docket.searchBrowse.attributes.value = {
      product_form: "Capsule",
      support_areas: "Joint support",
      search_keywords: "joint supplement",
    };

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            shortDescription: "",
            longDescription: "",
            bulletPoints: [],
            brand: "",
            docket,
            normalizedPayload: {
              docketHydrationStatus: ["imported_docket_ready", "report_backfill_pending"],
            },
          })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const textareaValues = Array.from(container.querySelectorAll("textarea")).map((entry) => entry.value);
    expect(textareaValues).toContain("Docket short description");
    expect(textareaValues).toContain("Docket long description");
    expect(textareaValues).toContain("Docket bullet one\nDocket bullet two");
    expect(container.querySelector('[data-testid="ecomviper-walmart-hydration-status"]')).toBeNull();
    expect(container.querySelector('[data-testid="ecomviper-walmart-docket-freshness-panel"]')).toBeNull();
    expect(container.textContent).toContain("View diagnostics (optional)");
    expect(container.textContent).toContain("Report backfill controls");
    expect(container.textContent).toContain("Request ITEM Report");
    expect(container.textContent).toContain("Check Report Status");
    expect(container.textContent).toContain("Apply Ready Report");
    expect(container.innerHTML).toContain("Joint support");
  });

  it("shows truthful no-credentials ITEM report blocked state without hiding existing docket fields", async () => {
    const docket = createEmptyWalmartDocket({
      sku: "ROC949",
      statuses: ["imported_docket_ready", "report_unavailable"],
    });
    docket.content.shortDescription.value = "Existing short";
    docket.content.longDescription.value = "Existing long";
    docket.content.bullets.value = ["Existing bullet"];

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            shortDescription: "Existing short",
            longDescription: "Existing long",
            bulletPoints: ["Existing bullet"],
            docket,
            normalizedPayload: {
              docketHydrationStatus: ["imported_docket_ready", "report_unavailable"],
              itemReportBackfill: {
                status: "request_blocked_no_credentials",
                requestId: null,
                reportType: "ITEM",
              },
            },
          })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    expect(container.textContent).toContain("No Walmart credentials configured for ITEM report backfill.");
    expect(container.textContent).toContain("Existing short");
    expect(container.textContent).toContain("Existing long");
    expect(container.textContent).toContain("Existing bullet");
  });
});
