import { describe, expect, it } from "vitest";
import { reconcileFileIqArtifactsForSupplier } from "@/lib/fileiq/fileiq-reconciliation";
import type { FileIqSupplierArtifactRecord } from "@/lib/fileiq/fileiq-db-core";

function artifact(overrides: Partial<FileIqSupplierArtifactRecord>): FileIqSupplierArtifactRecord {
  return {
    artifactId: overrides.artifactId ?? "artifact-1",
    jobId: overrides.jobId ?? "job-1",
    bundleId: overrides.bundleId ?? "bundle-1",
    bundleName: overrides.bundleName ?? "Rocktomic - 2026-06-04",
    supplierId: overrides.supplierId ?? "rocktomic-labs-llc",
    sourceFileId: overrides.sourceFileId ?? "file-1",
    sourceFileName: overrides.sourceFileName ?? "rocktomic-catalog.pdf",
    sourceFileType: overrides.sourceFileType ?? "pdf",
    sourceRole: overrides.sourceRole ?? "uploaded_file",
    sourceMetadata: overrides.sourceMetadata ?? {},
    artifactType: overrides.artifactType ?? "agent_result",
    storageUri: overrides.storageUri ?? "inline:payload",
    payload: overrides.payload ?? {},
    createdBy: overrides.createdBy ?? "user_1",
    createdAt: overrides.createdAt ?? "2026-06-04T15:00:00.000Z",
  };
}

describe("fileiq reconciliation", () => {
  it("merges catalog and inventory source artifacts by SKU with provenance and conflicts", () => {
    const catalogArtifact = artifact({
      artifactId: "artifact-catalog",
      sourceFileName: "Roctomic - Supplement-&-Apparel-Catalog.pdf",
      sourceFileType: "pdf",
      payload: {
        schemaType: "product_catalog",
        schemaVersion: "1.1",
        supplier: { supplierName: "Rocktomic Labs LLC" },
        products: [
          {
            sku: "ROC948",
            productName: "ROC948 Nitric Oxide Gummies",
            category: "Nitric Oxide",
            details: {
              suggestedUse: "Take 2 gummies daily.",
              warnings: "Keep out of reach of children.",
              certifications: ["nsf_certified"],
            },
            supplementFacts: {
              servingSize: "2 gummies",
              servingsPerContainer: "30",
              ingredients: [{ name: "L-Arginine", amount: "1000", unit: "mg" }],
            },
            physical: {
              weightOz: 6,
            },
            extraction: { sourceRef: "page 42" },
          },
        ],
      },
    });

    const inventoryArtifact = artifact({
      artifactId: "artifact-inventory",
      jobId: "job-2",
      sourceFileId: "file-2",
      sourceFileName: "rocktomic_inventory_2026-06-04.csv",
      sourceFileType: "csv",
      createdAt: "2026-06-04T15:05:00.000Z",
      payload: {
        schemaType: "product_catalog",
        schemaVersion: "1.1",
        supplier: { supplierName: "Rocktomic Labs LLC" },
        products: [
          {
            sku: "ROC948",
            productName: "ROC948 Nitric Oxide Gummies",
            category: "Investment Club",
            inventory: {
              status: "in_stock",
              accessLevel: "product_investment_club",
            },
            pricing: {
              msrp: 39.99,
            },
            extraction: { sourceRef: "row 12" },
          },
        ],
      },
    });

    const reconciled = reconcileFileIqArtifactsForSupplier("rocktomic-labs-llc", [
      inventoryArtifact,
      catalogArtifact,
    ]);

    expect(reconciled).not.toBeNull();
    const product = reconciled?.catalog.products[0] as Record<string, unknown>;
    const inventory = product.inventory as Record<string, unknown>;
    const details = product.details as Record<string, unknown>;
    const supplementFacts = product.supplementFacts as Record<string, unknown>;

    expect(product.sku).toBe("ROC948");
    expect(product.category).toBe("Nitric Oxide");
    expect(inventory.status).toBe("in_stock");
    expect(inventory.accessLevel).toBe("product_investment_club");
    expect((product.pricing as Record<string, unknown>).msrp).toBe(39.99);
    expect(details.suggestedUse).toBe("Take 2 gummies daily.");
    expect(supplementFacts.servingSize).toBe("2 gummies");
    expect(reconciled?.metadata.provenanceBySku.ROC948["inventory.accessLevel"]?.sourceKind).toBe("inventory_csv");
    expect(reconciled?.metadata.provenanceBySku.ROC948["category"]?.sourceKind).toBe("supplement_catalog_pdf");
    expect(reconciled?.metadata.conflictsBySku.ROC948.some((entry) => entry.fieldPath === "category")).toBe(true);
    expect(reconciled?.metadata.completenessBySku.ROC948.readyForEcomViper).toBe(true);
  });

  it("records warnings when pricing is missing without failing reconciliation", () => {
    const reconciled = reconcileFileIqArtifactsForSupplier("rocktomic-labs-llc", [
      artifact({
        payload: {
          schemaType: "product_catalog",
          schemaVersion: "1.1",
          products: [
            {
              sku: "ROC949",
              productName: "ROC949 Magnesium Gummies",
              inventory: { status: "in_stock" },
              supplementFacts: {
                servingSize: "1 gummy",
                ingredients: [{ name: "Magnesium", amount: "30", unit: "mg" }],
              },
            },
          ],
        },
      }),
    ]);

    expect(reconciled).not.toBeNull();
    expect(reconciled?.catalog.totalProductsFound).toBe(1);
    expect(reconciled?.metadata.completenessBySku.ROC949.warnings).toContain("pricing_missing");
    expect(reconciled?.metadata.completenessBySku.ROC949.readyForEcomViper).toBe(false);
  });
});
