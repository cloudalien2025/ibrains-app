import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("supplier intelligence CLI summary", () => {
  it("prints selected sku, source status, and extraction fields", () => {
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
      ],
      { encoding: "utf8" }
    );

    expect(output).toContain("selected_sku=ROC948");
    expect(output).toContain("records_extracted=1");
    expect(output).toContain("sourceStatus=");
    expect(output).toContain("missingFields=");
    expect(output).toContain("summary:");
  });
});
