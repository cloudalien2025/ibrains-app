import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge mission-control IA contract", () => {
  it("renders agency navigation and mission-control-first workspace", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Mission Control")).toBe(true);
    expect(source.includes("Strategy")).toBe(true);
    expect(source.includes("Brand")).toBe(true);
    expect(source.includes("Funnels")).toBe(true);
    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Global Assets")).toBe(true);
    expect(source.includes("Thrive Intelligence")).toBe(true);
    expect(source.includes("Experiments")).toBe(true);
    expect(source.includes("Publish")).toBe(true);
    expect(source.includes("Settings")).toBe(true);
  });

  it("keeps approval helper contract while moving away from simple-step labels", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("buttonLabel: `Approve ${normalizePageApprovalName(selectedPage.title)}`")).toBe(true);
    expect(source.includes("label: \"Connect Site\"")).toBe(false);
    expect(source.includes("label: \"Tell Us About Your Business\"")).toBe(false);
  });
});
