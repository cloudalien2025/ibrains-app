import { describe, expect, it } from "vitest";
import { importRocktomicPackageToEcommerceDb } from "@/lib/ecommerce/rocktomic-import-runner";
import type { RocktomicPackageArtifacts } from "@/lib/ecommerce/rocktomic-package-import";

class FakePool {
  public readonly calls: Array<{ text: string; params: unknown[] }> = [];

  async query(text: string, params: unknown[] = []): Promise<{ rows: Array<{ id?: string }> }> {
    this.calls.push({ text, params });
    if (text.includes("RETURNING id")) {
      return { rows: [{ id: "pkg_import_1" }] };
    }
    return { rows: [] };
  }
}

describe("phase4 import sanitization", () => {
  it("sanitizes null-byte payloads before jsonb insert/upsert", async () => {
    const artifacts: RocktomicPackageArtifacts = {
      sources: { supplier: "Rocktomic", sources: [] },
      sourceFacts: [
        {
          sku: "ROC001",
          productName: "Test\u0000 Product",
          directions: "Mix\u0000 daily",
          sourceEvidence: { supplementFacts: { sourceMethod: "ai_pdf_text", needsReview: false, note: "bad\u0000note" } },
        },
      ],
      pricing: [{ sku: "ROC001" }],
      inventory: [{ sku: "ROC001" }],
      assets: [{ sku: "ROC001", assetReadiness: {}, assets: [{ role: "coa", value: "abc\u0000def" }] }],
      validationReport: {
        supplierSlug: "rocktomic",
        generatedAt: "2026-05-31T00:00:00.000Z",
        validationPolicyVersion: "phase4_test",
        packageStatus: "pass",
        totalSkusDiscovered: 1,
        totalSkusValidated: 1,
        usableSkuCount: 1,
        usableWithWarningsSkuCount: 0,
        blockedSkuCount: 0,
        extractionErrorSkuCount: 0,
        skuValidationResults: [
          {
            sku: "ROC001",
            productName: "Test\u0000 Product",
            status: "usable",
            blockingDefects: [],
            warningDefects: [],
            missingFields: [],
            sourceNotes: ["note\u0000 one"],
            readiness: {},
          },
        ],
      },
      catalogLinkEvidence: {},
      templateAssetEvidence: {},
      aiLabelTextEvidence: { records: [] },
      ocrEvidence: [],
    };

    const pool = new FakePool();
    await importRocktomicPackageToEcommerceDb({
      pool: pool as unknown as { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ id?: string }> }> },
      artifacts,
      artifactManifest: { files: [] },
      sourceGitSha: null,
    });

    const serializedParams = JSON.stringify(pool.calls.map((call) => call.params));
    expect(serializedParams.includes("\\u0000")).toBe(false);
  });
});
