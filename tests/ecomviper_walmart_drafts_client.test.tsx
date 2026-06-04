import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WalmartDraftsClient from "@/app/optiwal/drafts/drafts-client";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createDraft(overrides?: Partial<WalmartDraftRecord>): WalmartDraftRecord {
  return {
    id: "ev_draft_roc808",
    productId: "walmart_roc808",
    marketplace: "walmart",
    sku: "ROC808",
    productTitle: "ROC808 Product",
    draftPayload: {
      title: "ROC808 Optimized Title",
      price: 29.99,
      inventoryQuantity: 9,
    },
    changeSummary: "3 staged field(s)",
    createdBy: "user_test",
    status: "validated",
    validationResult: {
      valid: true,
      warnings: [],
      suggestions: [],
    },
    publishStatus: "pending",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart drafts client states", () => {
  it("shows empty state only when no drafts and no load error", () => {
    const html = renderToStaticMarkup(<WalmartDraftsClient initialDrafts={[]} />);
    expect(html).toContain("No staged drafts yet.");
  });

  it("shows load error state instead of empty state when fetch fails", () => {
    const html = renderToStaticMarkup(
      <WalmartDraftsClient
        initialDrafts={[]}
        loadError="Could not load drafts right now. Please try again."
      />
    );

    expect(html).toContain("Could not load drafts right now. Please try again.");
    expect(html).not.toContain("No staged drafts yet.");
  });

  it("renders saved draft row details", () => {
    const html = renderToStaticMarkup(<WalmartDraftsClient initialDrafts={[createDraft()]} />);
    expect(html).toContain("ROC808");
    expect(html).toContain("3 staged field(s)");
    expect(html).toContain("pending");
  });
});
