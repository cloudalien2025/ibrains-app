import { describe, expect, it } from "vitest";
import {
  loadRocktomicPackageArtifacts,
  mapRocktomicPackageToEcommerceRows,
} from "@/lib/ecommerce/rocktomic-package-import";

function hasStatus(rows: Array<Record<string, unknown>>, status: string): boolean {
  return rows.some((row) => row.validation_status === status);
}

describe("rocktomic package import mapping", () => {
  it("maps package artifacts into row sets across all ecommerce supplier tables", async () => {
    const { artifacts, artifactManifest } = await loadRocktomicPackageArtifacts(process.cwd());
    const mapped = mapRocktomicPackageToEcommerceRows({ artifacts, artifactManifest, sourceGitSha: "abc123" });

    const expectedSkuCount = Number(artifacts.validationReport.totalSkusValidated || 0);

    expect(mapped.supplier.supplierSlug).toBe("rocktomic");
    expect(mapped.products).toHaveLength(expectedSkuCount);
    expect(mapped.productFacts).toHaveLength(expectedSkuCount);
    expect(mapped.pricing).toHaveLength(expectedSkuCount);
    expect(mapped.inventory).toHaveLength(expectedSkuCount);
    expect(mapped.assets).toHaveLength(expectedSkuCount);
    expect(mapped.validationResults).toHaveLength(expectedSkuCount);

    expect(hasStatus(mapped.products, "blocked")).toBe(true);
    expect(hasStatus(mapped.products, "usable")).toBe(true);
    expect(hasStatus(mapped.products, "usable_with_warnings")).toBe(true);

    const assetWithAi = mapped.assets.find((row) => row.ai_label_text_evidence && row.ai_label_text_evidence !== null);
    expect(assetWithAi).toBeTruthy();

    const serializedAsset = JSON.stringify(assetWithAi);
    expect(serializedAsset).not.toMatch(/"localPath"\s*:/i);
    expect(serializedAsset).not.toContain("/tmp/");

    const blockedValidationRow = mapped.validationResults.find((row) => row.validation_status === "blocked");
    expect(blockedValidationRow).toBeTruthy();
    expect(Array.isArray(blockedValidationRow?.blocking_defects)).toBe(true);

    const anyReadiness = mapped.validationResults.find((row) => typeof row.readiness === "object" && row.readiness !== null);
    expect(anyReadiness).toBeTruthy();
    const serializedReadiness = JSON.stringify(anyReadiness?.readiness);
    expect(serializedReadiness).toContain("usableForProductEditor");
    const reportReadiness = JSON.stringify((artifacts.validationReport.skuValidationResults as Array<Record<string, unknown>>)[0]?.readiness || {});
    if (reportReadiness.includes("ingredientMatchingReadiness")) {
      expect(serializedReadiness).toContain("ingredientMatchingReadiness");
      expect(serializedReadiness).toContain("productEditorFactsReadiness");
      expect(serializedReadiness).toContain("complianceEvidenceReadiness");
    }

    expect(mapped.packageImport.packageStatus).toBe(String(artifacts.validationReport.packageStatus));
    expect(mapped.summary.totalSkus).toBe(expectedSkuCount);
  });
});
