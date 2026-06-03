import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fileIqNavItems } from "@/lib/fileiq/fileiq-nav";
import { fileIqDatabaseBoundary, fileIqPlannedTables } from "@/lib/fileiq/fileiq-schema";

const MIGRATION_SQL = fs.readFileSync(
  path.join(process.cwd(), "db/ecommerce/migrations/20260603_fileiq_source_registry.sql"),
  "utf8",
);

describe("FileIQ Phase 1.1 nav state", () => {
  it("Source Bundles nav item is ready in Phase 1.1", () => {
    const item = fileIqNavItems.find((n) => n.href === "/fileiq/source-bundles");
    expect(item).toBeDefined();
    expect(item?.ready).toBe(true);
  });

  it("exactly two nav items are ready: Command Center and Source Bundles", () => {
    const ready = fileIqNavItems.filter((n) => n.ready);
    expect(ready).toHaveLength(2);
    expect(ready.map((n) => n.label)).toEqual(["Command Center", "Source Bundles"]);
  });

  it("eight nav items remain not-ready placeholders", () => {
    expect(fileIqNavItems.filter((n) => !n.ready)).toHaveLength(8);
  });
});

describe("FileIQ Phase 1.1 migration state", () => {
  it("migration state advances to source_registry after Phase 1.1", () => {
    expect(fileIqDatabaseBoundary.migrationState).toBe("source_registry");
  });

  it("still targets the shared ecommerce DB", () => {
    expect(fileIqDatabaseBoundary.sharedDatabaseEnvVar).toBe("ECOMMERCE_DATABASE_URL");
  });
});

describe("FileIQ source registry planned tables", () => {
  it("fileiq_source_bundles is in the planned table list", () => {
    expect(fileIqPlannedTables).toContain("fileiq_source_bundles");
  });

  it("fileiq_source_files is in the planned table list", () => {
    expect(fileIqPlannedTables).toContain("fileiq_source_files");
  });
});

describe("FileIQ source registry migration SQL", () => {
  it("creates the fileiq_source_bundles table", () => {
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS fileiq_source_bundles");
  });

  it("creates the fileiq_source_files table", () => {
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS fileiq_source_files");
  });

  it("enforces content-hash dedupe per bundle with a UNIQUE constraint", () => {
    expect(MIGRATION_SQL).toContain("UNIQUE (bundle_id, content_hash)");
  });

  it("foreign-keys fileiq_source_files to fileiq_source_bundles with CASCADE delete", () => {
    expect(MIGRATION_SQL).toContain(
      "REFERENCES fileiq_source_bundles(id) ON DELETE CASCADE",
    );
  });

  it("uses ECOMMERCE_DATABASE_URL comment boundary marker", () => {
    expect(MIGRATION_SQL).toContain("ECOMMERCE_DATABASE_URL");
  });

  it("includes indexes on bundle_id, supplier_id, content_hash, and file_type for source_files", () => {
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_files_bundle_id");
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_files_supplier_id");
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_files_content_hash");
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_files_file_type");
  });

  it("includes indexes on supplier_id and status for source_bundles", () => {
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_bundles_supplier_id");
    expect(MIGRATION_SQL).toContain("idx_fileiq_source_bundles_status");
  });

  it("stores metadata as JSONB on both tables", () => {
    const bundleMetaCount = (MIGRATION_SQL.match(/metadata JSONB/g) ?? []).length;
    expect(bundleMetaCount).toBeGreaterThanOrEqual(2);
  });
});
