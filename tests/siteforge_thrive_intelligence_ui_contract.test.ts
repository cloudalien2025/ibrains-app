import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge plan summary contract", () => {
  it("shows compact plan summary inside Describe", () => {
    const sourcePath = path.join(process.cwd(), "app/pagebolt/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Plan summary")).toBe(true);
    expect(source.includes("Homepage goal")).toBe(true);
    expect(source.includes("Key messages")).toBe(true);
    expect(source.includes("Proposed pages")).toBe(true);
    expect(source.includes("Primary CTA")).toBe(true);
    expect(source.includes("Approve Homepage")).toBe(false);
    expect(source.includes("Use this page set")).toBe(false);
    expect(source.includes("Use this CTA style")).toBe(false);
    expect(source.includes("Approve reuse decisions")).toBe(false);
    expect(source.includes("Asset intelligence")).toBe(false);
    expect(source.includes("Top symbols")).toBe(false);
    expect(source.includes("Builder payload present")).toBe(false);
  });
});
