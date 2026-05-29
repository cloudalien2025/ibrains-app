import { describe, expect, it } from "vitest";
import { getRocktomicSourceConfigSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-config";

describe("rocktomic source config snapshot", () => {
  it("returns configured and pending source references for platform-managed ingestion", () => {
    const snapshot = getRocktomicSourceConfigSnapshot();
    expect(snapshot.supplier).toBe("Rocktomic");
    expect(snapshot.references.length).toBeGreaterThan(0);
    expect(snapshot.configuredReferenceCount).toBeGreaterThan(0);
    expect(snapshot.pendingReferenceCount).toBeGreaterThan(0);
    expect(snapshot.references.some((reference) => reference.id === "catalog_pdf")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "label_templates")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "order_refund_policy")).toBe(true);
  });
});
