import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge guided brief UI contract", () => {
  it("renders setup brief fields and removes old quick suggestion chips", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("About your website")).toBe(true);
    expect(source.includes("Website Prompt")).toBe(false);
    expect(source.includes("Health & Wellness")).toBe(false);
    expect(source.includes("Ecommerce")).toBe(false);
    expect(source.includes("Coaching")).toBe(false);
    expect(source.includes("SaaS")).toBe(false);
  });

  it("renders AI access controls", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("AI access")).toBe(true);
    expect(source.includes("Save API Keys")).toBe(true);
    expect(source.includes("Remove Saved Keys")).toBe(true);
    expect(source.includes("SerpApi API key")).toBe(true);
  });
});
