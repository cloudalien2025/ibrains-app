import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("directoryiq authority slot schema migration contract", () => {
  it("sets the named slot index check constraint to allow slots 1..5", () => {
    const migrationPath = path.join(process.cwd(), "migrations/20260320_directoryiq_step2_slot_contract_alignment.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("directoryiq_authority_posts_slot_index_check");
    expect(sql).toContain("slot_index >= 1 AND slot_index <= 5");
  });
});
