import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAllRocktomicProductInputs } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-data";

async function makeRepoWithSupplierArtifacts(input: {
  sourceFacts: unknown[];
  assets: unknown[];
  pricing: unknown[];
  inventory: unknown[];
  aiLabelRecords?: unknown[];
}): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "copywriting-mapping-"));
  const latest = path.join(tmp, "data/ecomviper/suppliers/rocktomic/latest");
  await fs.mkdir(latest, { recursive: true });

  await fs.writeFile(path.join(latest, "sourceFacts.json"), JSON.stringify(input.sourceFacts, null, 2));
  await fs.writeFile(path.join(latest, "assets.json"), JSON.stringify(input.assets, null, 2));
  await fs.writeFile(path.join(latest, "pricing.json"), JSON.stringify(input.pricing, null, 2));
  await fs.writeFile(path.join(latest, "inventory.json"), JSON.stringify(input.inventory, null, 2));
  await fs.writeFile(
    path.join(latest, "ai-label-text-evidence.json"),
    JSON.stringify({ records: input.aiLabelRecords || [] }, null, 2)
  );
  return tmp;
}

describe("ecomviper copywriting agent supplement facts mapping hotfix", () => {
  it("maps ROC123-like nested supplement facts and avoids blanket Supplement Facts missing", async () => {
    const repoRoot = await makeRepoWithSupplierArtifacts({
      sourceFacts: [
        {
          sku: "ROC123",
          productName: "Oxy Burn",
          supplementFacts: {
            servingSize: null,
            servingsPerContainer: null,
            activeIngredients: ["Caffeine"],
            amountPerServing: ["Caffeine 200mg"],
            otherIngredients: [],
          },
          sourceEvidence: {
            supplementFacts: {
              sourceMethod: "ai_pdf_text",
              needsReview: true,
            },
          },
        },
      ],
      assets: [
        {
          sku: "ROC123",
          coaUrl: "https://example.com/coa.pdf",
          labelTemplateAiUrl: "https://example.com/label.ai",
          mockupTemplateTifUrl: "https://example.com/mockup.tif",
          labelTemplateUrl: "https://example.com/label.ai",
          mockupUrl: "https://example.com/mockup.tif",
        },
      ],
      pricing: [{ sku: "ROC123", wholesaleCost: 14.92, msrp: null }],
      inventory: [{ sku: "ROC123", inventoryStatus: "in_stock" }],
      aiLabelRecords: [{ sku: "ROC123", extractionStatus: "reused_cached", needsReview: true }],
    });

    const rows = await loadAllRocktomicProductInputs(repoRoot);
    const roc123 = rows.find((row) => row.input.variants[0]?.sku === "ROC123");
    expect(roc123).toBeTruthy();

    const input = roc123!.input;
    expect(input.supplementFacts.activeIngredients).toContain("Caffeine");
    expect(input.supplementFacts.ingredientAmounts).toContain("Caffeine 200mg");
    expect(input.sourceEvidence.labelEvidencePresent).toBe(true);
    expect(input.sourceEvidence.aiLabelTextEvidencePresent).toBe(true);
    expect(input.missingData.supplementFactsMissing).toBe(false);
    expect(input.missingData.ingredientFactsMissing).toBe(false);
    expect(input.missingData.ingredientAmountsMissing).toBe(false);
    expect(input.missingData.servingSizeMissing).toBe(true);
    expect(input.missingData.servingsPerContainerMissing).toBe(true);
  });

  it("keeps true no-evidence products flagged as Supplement Facts missing", async () => {
    const repoRoot = await makeRepoWithSupplierArtifacts({
      sourceFacts: [{ sku: "ROC404", productName: "No Facts Product" }],
      assets: [{ sku: "ROC404" }],
      pricing: [{ sku: "ROC404", msrp: null, wholesaleCost: null }],
      inventory: [{ sku: "ROC404", inventoryStatus: "unknown" }],
      aiLabelRecords: [],
    });

    const rows = await loadAllRocktomicProductInputs(repoRoot);
    const row = rows.find((entry) => entry.input.variants[0]?.sku === "ROC404");
    expect(row).toBeTruthy();
    expect(row!.input.missingData.supplementFactsMissing).toBe(true);
    expect(row!.input.missingData.ingredientFactsMissing).toBe(true);
  });
});
