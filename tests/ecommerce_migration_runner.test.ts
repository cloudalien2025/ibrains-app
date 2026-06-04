import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runEcommerceMigrations } from "@/lib/ecommerce/migration-runner";

interface FakeResult {
  rowCount: number;
  rows: Array<{ migrationName: string; migrationChecksum: string }>;
}

class FakePool {
  private readonly applied = new Map<string, string>();

  async query(text: string, params: unknown[] = []): Promise<FakeResult> {
    if (text.includes("CREATE TABLE IF NOT EXISTS ecommerce_schema_migrations")) {
      return { rowCount: 0, rows: [] };
    }

    if (text.includes("SELECT migration_name AS \"migrationName\"")) {
      const name = String(params[0] || "");
      const checksum = this.applied.get(name);
      if (!checksum) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ migrationName: name, migrationChecksum: checksum }] };
    }

    if (text.includes("INSERT INTO ecommerce_schema_migrations")) {
      const name = String(params[0] || "");
      const checksum = String(params[1] || "");
      this.applied.set(name, checksum);
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }
}

describe("ecommerce migration runner", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("tracks migrations and is idempotent on repeated runs", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ecom-migrations-"));
    tempDirs.push(dir);

    await fs.writeFile(path.join(dir, "20260601_test.sql"), "CREATE TABLE IF NOT EXISTS phase4_test(id text primary key);");

    const pool = new FakePool();

    const firstRun = await runEcommerceMigrations({
      pool: pool as unknown as { query: (text: string, params?: unknown[]) => Promise<FakeResult> },
      migrationsDirectory: dir,
      maskedTarget: "postgres://user:***@host/db",
    });

    const secondRun = await runEcommerceMigrations({
      pool: pool as unknown as { query: (text: string, params?: unknown[]) => Promise<FakeResult> },
      migrationsDirectory: dir,
      maskedTarget: "postgres://user:***@host/db",
    });

    expect(firstRun.applied).toHaveLength(1);
    expect(firstRun.skipped).toHaveLength(0);
    expect(secondRun.applied).toHaveLength(0);
    expect(secondRun.skipped).toHaveLength(1);
  });
});
