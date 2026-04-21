import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge guided brief UI contract", () => {
  it("renders simple business-info fields and avoids legacy prompt chips", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Tell Us About Your Business")).toBe(true);
    expect(source.includes("Business name")).toBe(true);
    expect(source.includes("Target audience")).toBe(true);
    expect(source.includes("Website Prompt")).toBe(false);
    expect(source.includes("Health & Wellness")).toBe(false);
    expect(source.includes("Ecommerce")).toBe(false);
    expect(source.includes("Coaching")).toBe(false);
    expect(source.includes("SaaS")).toBe(false);
  });

  it("renders AI key controls in the business step", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("OpenAI API key")).toBe(true);
    expect(source.includes("Save API Keys")).toBe(true);
    expect(source.includes("Remove Saved Keys")).toBe(true);
    expect(source.includes("SerpApi API key (optional)")).toBe(true);
  });
});
