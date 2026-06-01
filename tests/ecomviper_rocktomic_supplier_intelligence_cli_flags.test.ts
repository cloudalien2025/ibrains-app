import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("rocktomic supplier intelligence cli flags", () => {
  it("accepts panel extraction flags in dry-run", () => {
    const output = execFileSync(
      "npx",
      [
        "--yes",
        "tsx",
        "scripts/ecomviper/build_rocktomic_supplier_intelligence.ts",
        "--fixtures",
        "--sku",
        "ROC948",
        "--dry-run",
        "--extract-panels",
        "--render-pdf-pages",
      ],
      { encoding: "utf8" }
    );

    expect(output).toContain("selected_sku=ROC948");
    expect(output).toContain("summary:");
  });

  it("rejects unsafe candidate directory outside repo", () => {
    expect(() =>
      execFileSync(
        "npx",
        [
          "--yes",
          "tsx",
          "scripts/ecomviper/build_rocktomic_supplier_intelligence.ts",
          "--fixtures",
          "--sku",
          "ROC948",
          "--dry-run",
          "--write-candidates",
          "--candidate-dir",
          "/tmp/outside-repo",
        ],
        { encoding: "utf8" }
      )
    ).toThrow();
  });
});

