import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 1.5 runtime DB behavior guard", () => {
  it("keeps existing ecomviper query utility bound to the current shared pool path", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/api/ecomviper/_utils/db.ts"), "utf8");

    expect(source).toContain("getDirectoryIqPool");
    expect(source).not.toContain("getEcommercePool");
    expect(source).not.toContain("ECOMMERCE_DATABASE_URL");
  });
});
