import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time user journey UI contract", () => {
  it("uses a simple non-technical 6-step flow", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Connect Site"')).toBe(true);
    expect(source.includes('label: "Tell Us About Your Business"')).toBe(true);
    expect(source.includes('label: "Generate Site"')).toBe(true);
    expect(source.includes('label: "Review Pages"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes('label: "Done"')).toBe(true);

    expect(source.includes("Validate Connection")).toBe(true);
    expect(source.includes("Continue")).toBe(true);
    expect(source.includes("Generate Site")).toBe(true);
    expect(source.includes("Review Pages")).toBe(true);
    expect(source.includes("Build Draft")).toBe(true);
    expect(source.includes("Finish")).toBe(true);

    expect(source.includes("buttonLabel: `Approve ${normalizePageApprovalName(selectedPage.title)}`")).toBe(true);
    expect(source.includes("Mission Control")).toBe(false);
    expect(source.includes("Publish")).toBe(true);
    expect(source.includes("Strategy Director")).toBe(false);
  });
});
