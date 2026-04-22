import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge setup brief and AI contract", () => {
  it("renders setup-first brief fields", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("About your website")).toBe(true);
    expect(source.includes("Business name")).toBe(true);
    expect(source.includes("Target audience")).toBe(true);
    expect(source.includes("Save Website Brief")).toBe(true);
    expect(source.includes("SEO Settings")).toBe(false);
  });

  it("renders AI access controls in setup", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("AI access")).toBe(true);
    expect(source.includes("OpenAI API key")).toBe(true);
    expect(source.includes("Save API Keys")).toBe(true);
    expect(source.includes("Remove Saved Keys")).toBe(true);
    expect(source.includes("SerpApi API key (optional)")).toBe(true);
  });
});
