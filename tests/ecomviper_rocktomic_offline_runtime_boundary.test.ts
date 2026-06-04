import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolute));
      continue;
    }
    if (entry.isFile() && (absolute.endsWith(".ts") || absolute.endsWith(".tsx"))) {
      files.push(absolute);
    }
  }
  return files;
}

describe("rocktomic offline validation runtime boundary", () => {
  it("keeps offline validation/build modules out of app routes and components", () => {
    const appFiles = collectFiles(path.join(process.cwd(), "app"));
    const componentFiles = collectFiles(path.join(process.cwd(), "components"));
    const scanned = [...appFiles, ...componentFiles];

    for (const file of scanned) {
      const source = fs.readFileSync(file, "utf8");
      expect(source.includes("rocktomic-validation-policy")).toBe(false);
      expect(source.includes("rocktomic-offline-audit")).toBe(false);
      expect(source.includes("rocktomic-pdf-assets")).toBe(false);
      expect(source.includes("rocktomic-template-assets")).toBe(false);
      expect(source.includes("rocktomic-supplement-facts-ocr")).toBe(false);
      expect(source.includes("rocktomic-ai-label-text")).toBe(false);
      expect(source.includes("build_rocktomic_supplier_data")).toBe(false);
    }
  });
});
