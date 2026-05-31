import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecommerce DB smoke-check script", () => {
  it("uses a minimal non-destructive SELECT 1 query", () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/ecommerce/check_database_connection.ts"),
      "utf8"
    );

    expect(script).toContain("getRequiredEcommerceDatabaseUrl");
    expect(script).toContain("SELECT 1 AS ok");
    expect(script).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  });
});
