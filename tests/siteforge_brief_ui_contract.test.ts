import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge describe and connect contract", () => {
  it("starts with intent prompt and examples", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("What kind of website do you want me to build?")).toBe(true);
    expect(source.includes("Create first direction")).toBe(true);
    expect(source.includes("Build a high-converting homepage for my AI pet app.")).toBe(true);
    expect(source.includes("Create a trusted local service website that gets calls.")).toBe(true);
    expect(source.includes("Build a boutique brand site with storytelling and email capture.")).toBe(true);
  });

  it("uses one connect moment with one primary action", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Connect and begin")).toBe(true);
    expect(source.includes("WordPress URL")).toBe(true);
    expect(source.includes("App password")).toBe(true);
    expect(source.includes("AI key")).toBe(true);
    expect(source.includes("Research key (optional)")).toBe(true);
    expect(source.includes("Save API Keys")).toBe(false);
    expect(source.includes("Validate Connection")).toBe(false);
  });
});
