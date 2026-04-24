import { describe, expect, it } from "vitest";
import {
  DOMARA_BATCH_LIMIT,
  buildBulkExportManifest,
  createDomaraBatch,
  generateContentCalendar,
  listSeriesTemplates,
  transitionBatchItemStatus,
} from "@/lib/studio/domara/batch-calendar";
import { PropertyListingInput } from "@/lib/studio/domara/types";

function listing(title: string): PropertyListingInput {
  return {
    country: "Italy",
    city: "Florence",
    title,
    imageUrls: [],
  };
}

describe("Domara batch + calendar", () => {
  it("creates batch items with initial draft status", () => {
    const batch = createDomaraBatch([listing("One"), listing("Two")], "hidden_gems_tuscany");

    expect(batch.items).toHaveLength(2);
    expect(batch.items[0]?.status).toBe("draft");
    expect(batch.items[0]?.seriesTemplate).toBe("hidden_gems_tuscany");
  });

  it("supports status transitions", () => {
    const batch = createDomaraBatch([listing("One")], "italy_under_300k");
    const updated = transitionBatchItemStatus(batch.items[0]!, "ready_to_publish");

    expect(updated.status).toBe("ready_to_publish");
  });

  it("enforces batch item limit", () => {
    const source = Array.from({ length: DOMARA_BATCH_LIMIT + 3 }, (_, index) => listing(`Listing ${index + 1}`));
    const batch = createDomaraBatch(source, "european_second_homes");

    expect(batch.items).toHaveLength(DOMARA_BATCH_LIMIT);
  });

  it("applies series template defaults and exposes template catalog", () => {
    const templates = listSeriesTemplates();
    const batch = createDomaraBatch([listing("Template Test")], "italy_under_300k");

    expect(templates.some((template) => template.name === "italy_under_300k")).toBe(true);
    expect(batch.items[0]?.contentAngle).toBe("deal_spotlight");
  });

  it("generates content calendar and export manifest", () => {
    const batch = createDomaraBatch([listing("Calendar One"), listing("Calendar Two")], "could_you_retire_here");
    const failed = transitionBatchItemStatus(batch.items[1]!, "failed", "Render timeout");
    const withFailure = {
      ...batch,
      items: [batch.items[0]!, failed],
    };

    const calendar = generateContentCalendar(withFailure);
    const manifest = buildBulkExportManifest(withFailure);

    expect(calendar).toHaveLength(2);
    expect(calendar[1]?.status).toBe("failed");
    expect(manifest.count).toBe(2);
    expect(manifest.items[1]?.status).toBe("failed");
  });
});
