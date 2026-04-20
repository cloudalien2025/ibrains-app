import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time user journey UI contract", () => {
  it("keeps the primary guided-builder journey clear", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Builder")).toBe(true);
    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Review")).toBe(true);
    expect(source.includes("Setup")).toBe(true);
    expect(source.includes("Thrive Assets")).toBe(true);
    expect(source.includes("Advanced")).toBe(true);

    expect(source.includes("Current Step")).toBe(true);
    expect(source.includes("Task List")).toBe(true);
    expect(source.includes("Ask SiteForge")).toBe(true);
    expect(source.includes("Workspace")).toBe(true);
    expect(source.includes("Website Strategy Brief")).toBe(true);
    expect(source.includes("AI & Research API Configuration")).toBe(true);
    expect(source.includes("WordPress / Thrive Connection")).toBe(true);
    expect(source.includes("Thrive Setup &amp; Assets")).toBe(true);
    expect(source.includes("Reusable Assets Preview")).toBe(true);
    expect(source.includes("Selected Page Workflow")).toBe(true);
    expect(source.includes("Launch Checklist")).toBe(true);
  });
});
