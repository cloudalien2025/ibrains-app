import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCopywritingAgentPrepare } from "@/scripts/ecomviper/copywriting_agent_prepare";
import { runCopywritingAgentEvaluate } from "@/scripts/ecomviper/copywriting_agent_evaluate";

async function makeTempRepo(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "copywriting-agent-"));

  const fixtureSrc = path.join(process.cwd(), "data/ecomviper/copywriting-agent/fixtures/golden-products.json");
  const fixtureDest = path.join(tmp, "data/ecomviper/copywriting-agent/fixtures/golden-products.json");
  await fs.mkdir(path.dirname(fixtureDest), { recursive: true });
  await fs.copyFile(fixtureSrc, fixtureDest);

  return tmp;
}

describe("ecomviper copywriting agent scripts", () => {
  it("prepare supports all-mode in dry-run and does not write artifacts", async () => {
    const repoRoot = await makeTempRepo();

    const sourceFactsPath = path.join(repoRoot, "data/ecomviper/suppliers/rocktomic/latest/sourceFacts.json");
    const pricingPath = path.join(repoRoot, "data/ecomviper/suppliers/rocktomic/latest/pricing.json");
    const inventoryPath = path.join(repoRoot, "data/ecomviper/suppliers/rocktomic/latest/inventory.json");
    const assetsPath = path.join(repoRoot, "data/ecomviper/suppliers/rocktomic/latest/assets.json");

    await fs.mkdir(path.dirname(sourceFactsPath), { recursive: true });
    await fs.writeFile(sourceFactsPath, JSON.stringify([{ sku: "SKU-1", productName: "All Product One", activeIngredients: ["Magnesium"] }], null, 2));
    await fs.writeFile(pricingPath, JSON.stringify([{ sku: "SKU-1", msrp: 19.99 }], null, 2));
    await fs.writeFile(inventoryPath, JSON.stringify([{ sku: "SKU-1", inventoryStatus: "in_stock" }], null, 2));
    await fs.writeFile(assetsPath, JSON.stringify([{ sku: "SKU-1", coa: { url: null }, labelTemplate: { url: null } }], null, 2));

    const result = await runCopywritingAgentPrepare({
      all: true,
      fixtures: false,
      sku: null,
      handle: null,
      limit: null,
      dryRun: true,
    }, repoRoot);

    expect(result.summary.mode).toBe("all");
    expect(result.summary.selectedCount).toBe(1);
    await expect(fs.stat(path.join(repoRoot, "data/ecomviper/copywriting-agent/latest/prepared-inputs.json"))).rejects.toThrow();
  });

  it("evaluate supports fixtures mode in dry-run", async () => {
    const repoRoot = await makeTempRepo();

    const report = await runCopywritingAgentEvaluate({
      all: false,
      fixtures: true,
      sku: null,
      handle: null,
      limit: 2,
      dryRun: true,
    }, repoRoot);

    expect(report.mode).toBe("fixtures");
    expect(report.totals.selected).toBe(2);
    expect(report.totals.evaluated).toBeGreaterThan(0);
    await expect(fs.stat(path.join(repoRoot, "data/ecomviper/copywriting-agent/latest/eval-report.json"))).rejects.toThrow();
  });

  it("scripts and modules do not depend on OPENAI_API_KEY or OpenAI runtime", async () => {
    const files = [
      path.join(process.cwd(), "scripts/ecomviper/copywriting_agent_prepare.ts"),
      path.join(process.cwd(), "scripts/ecomviper/copywriting_agent_evaluate.ts"),
      path.join(process.cwd(), "lib/ecomviper/copywriting-agent/copywriting-agent-prompt.ts"),
      path.join(process.cwd(), "lib/ecomviper/copywriting-agent/copywriting-agent-input-builder.ts"),
    ];

    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      expect(source).not.toContain("OPENAI_API_KEY");
      expect(source).not.toContain("openai");
      expect(source).not.toContain("OpenAI");
    }
  });
});
