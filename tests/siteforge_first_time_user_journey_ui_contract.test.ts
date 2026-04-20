import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time user journey UI contract", () => {
  it("keeps the primary page-by-page journey clear", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Overview")).toBe(true);
    expect(source.includes("Setup")).toBe(true);
    expect(source.includes("Plan")).toBe(true);
    expect(source.includes("Reusable Assets")).toBe(true);
    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Launch")).toBe(true);

    expect(source.includes("Setup Progress")).toBe(true);
    expect(source.includes("Primary Action")).toBe(true);
    expect(source.includes("Thrive Setup &amp; Assets")).toBe(true);
    expect(source.includes("Website Strategy Brief")).toBe(true);
    expect(source.includes("AI & Research API Configuration")).toBe(true);
    expect(source.includes("WordPress / Thrive Connection")).toBe(true);
    expect(source.includes("Validation Results")).toBe(true);
    expect(source.includes("Reusable Assets Preview")).toBe(true);
    expect(source.includes("Selected Page Workflow")).toBe(true);
    expect(source.includes("Launch Checklist")).toBe(true);
  });
});
