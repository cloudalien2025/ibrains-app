import { describe, expect, it } from "vitest";
import {
  compareDraftUpdatedAtDesc,
  normalizeWalmartDraftsForEditor,
} from "@/lib/ecomviper/walmart/walmart-product-editor-hardening";

describe("Walmart product editor hardening", () => {
  it("normalizes malformed legacy draft rows without throwing", () => {
    const input = [
      null,
      {
        sku: "roc830",
        draftPayload: null,
        validationResult: null,
        status: "invalid_status",
        publishStatus: "invalid_publish_status",
        updatedAt: null,
        createdAt: "not-a-date",
      },
    ];

    const result = normalizeWalmartDraftsForEditor(input);

    expect(result.drafts.length).toBe(1);
    expect(result.diagnostics.droppedCount).toBe(1);
    expect(result.diagnostics.repairedCount).toBe(1);
    expect(result.drafts[0]?.sku).toBe("ROC830");
    expect(result.drafts[0]?.draftPayload).toEqual({});
    expect(result.drafts[0]?.validationResult.valid).toBe(true);
    expect(result.drafts[0]?.status).toBe("draft");
    expect(result.drafts[0]?.publishStatus).toBe("pending");
    expect(result.drafts[0]?.updatedAt).toMatch(/T/);
  });

  it("sort comparator remains safe when timestamps are missing or invalid", () => {
    const result = compareDraftUpdatedAtDesc(
      { updatedAt: "not-a-date" },
      { updatedAt: "2026-05-01T00:00:00.000Z" }
    );
    expect(result).toBeGreaterThan(0);
  });
});

