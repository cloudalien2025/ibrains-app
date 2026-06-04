import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export interface EcommerceMigrationEntry {
  migrationName: string;
  migrationChecksum: string;
}

export interface EcommerceMigrationResult {
  target: string;
  directory: string;
  applied: string[];
  skipped: string[];
}

const TRACKING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ecommerce_schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  migration_checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

function checksumSql(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function listEcommerceMigrationFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function ensureEcommerceMigrationTrackingTable(pool: Pick<Pool, "query">): Promise<void> {
  await pool.query(TRACKING_TABLE_SQL);
}

export async function runEcommerceMigrations(options: {
  pool: Pick<Pool, "query">;
  migrationsDirectory: string;
  maskedTarget: string;
}): Promise<EcommerceMigrationResult> {
  const { pool, migrationsDirectory, maskedTarget } = options;
  await ensureEcommerceMigrationTrackingTable(pool);

  const files = await listEcommerceMigrationFiles(migrationsDirectory);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filePath of files) {
    const migrationName = path.basename(filePath);
    const sql = await fs.readFile(filePath, "utf8");
    const migrationChecksum = checksumSql(sql);

    const existing = await pool.query<EcommerceMigrationEntry>(
      `SELECT migration_name AS "migrationName", migration_checksum AS "migrationChecksum"
         FROM ecommerce_schema_migrations
        WHERE migration_name = $1`,
      [migrationName]
    );

    if (existing.rows.length > 0 && existing.rows[0]) {
      if (existing.rows[0].migrationChecksum !== migrationChecksum) {
        throw new Error(
          `Checksum mismatch for applied migration ${migrationName}. Existing ${existing.rows[0].migrationChecksum}, current ${migrationChecksum}.`
        );
      }
      skipped.push(migrationName);
      continue;
    }

    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query(
        `INSERT INTO ecommerce_schema_migrations (migration_name, migration_checksum)
         VALUES ($1, $2)`,
        [migrationName, migrationChecksum]
      );
      await pool.query("COMMIT");
      applied.push(migrationName);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  return {
    target: maskedTarget,
    directory: migrationsDirectory,
    applied,
    skipped,
  };
}
