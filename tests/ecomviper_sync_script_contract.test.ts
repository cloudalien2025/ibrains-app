import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper sync script contract", () => {
  it("defines token-protected supplier source sync script", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/ecomviper_sync_supplier_sources.sh"), "utf8");
    expect(source).toContain("ECOMVIPER_SYNC_INTERNAL_TOKEN");
    expect(source).toContain("/api/ecomviper/supplier-sources/sync");
    expect(source).toContain("ECOMVIPER_SYNC_USER_ID");
  });
});
