import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ecomviper settings membership tier ui contract", () => {
  it("renders supplier membership selector and save workflow messaging", () => {
    const filePath = path.join(process.cwd(), "app/ecomviper/settings/supplier-membership-tier-form.tsx");
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("Supplier Membership Tier");
    expect(source).toContain("Select membership tier in Settings to calculate cost and profit.");
    expect(source).toContain("Run source sync to detect membership tiers.");
    expect(source).toContain("/api/ecomviper/settings/supplier-membership");
  });
});
