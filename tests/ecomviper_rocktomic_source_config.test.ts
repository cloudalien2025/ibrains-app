import { describe, expect, it } from "vitest";
import { getRocktomicSourceConfigSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-config";

describe("rocktomic source config snapshot", () => {
  it("returns configured and pending source references for platform-managed ingestion", () => {
    const snapshot = getRocktomicSourceConfigSnapshot();

    expect(snapshot.supplier).toBe("Rocktomic");
    expect(snapshot.references.length).toBe(7);
    expect(snapshot.configuredReferenceCount).toBe(6);
    expect(snapshot.pendingReferenceCount).toBe(1);

    expect(snapshot.references.some((reference) => reference.id === "catalog_pdf")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "label_mockup_templates")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "order_refund_policy")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "msrp_profit_margins_report")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "plds_catalog")).toBe(true);
    expect(snapshot.references.some((reference) => reference.id === "inventory_report")).toBe(true);

    const pendingReferences = snapshot.references.filter((reference) => reference.status === "pending");
    expect(pendingReferences).toHaveLength(1);
    expect(pendingReferences[0]?.id).toBe("coa_repository");
  });
});
