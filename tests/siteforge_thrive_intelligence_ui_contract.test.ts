import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge thrive intelligence UI contract", () => {
  it("renders agency mission control + thrive intelligence surfaces", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Mission Control")).toBe(true);
    expect(source.includes("Project Mission Card")).toBe(true);
    expect(source.includes("Agency Team Card")).toBe(true);
    expect(source.includes("Approval Queue Card")).toBe(true);
    expect(source.includes("Workstream Progress Board")).toBe(true);
    expect(source.includes("Thrive Snapshot Card")).toBe(true);
    expect(source.includes("Agency Pulse Activity Feed")).toBe(true);
    expect(source.includes("Risk / Warnings Card")).toBe(true);
    expect(source.includes("Thrive Intelligence")).toBe(true);
    expect(source.includes("Environment Snapshot Card")).toBe(true);
    expect(source.includes("Inventory Summary Card")).toBe(true);
    expect(source.includes("Symbol Intelligence Panel")).toBe(true);
    expect(source.includes("Template Intelligence Panel")).toBe(true);
    expect(source.includes("Risk / Safety Panel")).toBe(true);
    expect(source.includes("Refresh / Manifest Panel")).toBe(true);
    expect(source.includes("Page Studio")).toBe(true);
    expect(source.includes("Global Assets Library")).toBe(true);
  });
});
