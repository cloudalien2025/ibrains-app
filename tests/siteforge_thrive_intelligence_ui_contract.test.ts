import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge inline preview contract", () => {
  it("shows homepage/page-set/cta/reuse preview inside Describe", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Homepage preview")).toBe(true);
    expect(source.includes("Proposed page set")).toBe(true);
    expect(source.includes("CTA style recommendation")).toBe(true);
    expect(source.includes("Reuse recommendation")).toBe(true);
    expect(source.includes("Inline approvals")).toBe(true);
    expect(source.includes("Asset intelligence")).toBe(false);
    expect(source.includes("Top symbols")).toBe(false);
    expect(source.includes("Builder payload present")).toBe(false);
  });
});
