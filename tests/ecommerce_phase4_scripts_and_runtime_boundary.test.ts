import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("phase 4 scripts and runtime safety", () => {
  it("keeps migrate/import/verify scripts bound to ECOMMERCE_DATABASE_URL-only utility", () => {
    const migrate = fs.readFileSync(path.join(process.cwd(), "scripts/ecommerce/migrate.ts"), "utf8");
    const importer = fs.readFileSync(path.join(process.cwd(), "scripts/ecomviper/import_rocktomic_supplier_package.ts"), "utf8");
    const verify = fs.readFileSync(path.join(process.cwd(), "scripts/ecommerce/verify_rocktomic_supplier_import.ts"), "utf8");

    expect(migrate).toContain("getRequiredEcommerceDatabaseUrl");
    expect(importer).toContain("getRequiredEcommerceDatabaseUrl");
    expect(verify).toContain("getRequiredEcommerceDatabaseUrl");

    expect(migrate).not.toContain("process.env.DATABASE_URL");
    expect(importer).not.toContain("process.env.DATABASE_URL");
    expect(verify).not.toContain("process.env.DATABASE_URL");

    expect(verify).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  });

  it("uses idempotent upserts for package import tables", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib/ecommerce/rocktomic-import-runner.ts"), "utf8");

    expect(source).toContain("ON CONFLICT (supplier_slug, package_generated_at, package_policy_version)");
    expect(source).toContain("ON CONFLICT (supplier_slug, sku)");
    expect(source).not.toContain("writeFile(");
  });

  it("keeps migration/import logic out of runtime app/components", () => {
    const appFiles = collectFiles(path.join(process.cwd(), "app"));
    const componentFiles = collectFiles(path.join(process.cwd(), "components"));

    for (const file of [...appFiles, ...componentFiles]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source.includes("rocktomic-import-runner")).toBe(false);
      expect(source.includes("migration-runner")).toBe(false);
      expect(source.includes("import_rocktomic_supplier_package")).toBe(false);
      expect(source.includes("verify_rocktomic_supplier_import")).toBe(false);
    }
  });
});
