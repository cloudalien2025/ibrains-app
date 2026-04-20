import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time user journey UI contract", () => {
  it("keeps the primary labeled step-by-step builder journey clear", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Builder")).toBe(true);
    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Review")).toBe(true);
    expect(source.includes("Settings")).toBe(true);
    expect(source.includes("Thrive Assets")).toBe(true);
    expect(source.includes("Advanced")).toBe(true);

    expect(source.includes("Current Step")).toBe(true);
    expect(source.includes("Progress Steps")).toBe(true);
    expect(source.includes("Ask SiteForge")).toBe(true);
    expect(source.includes("Step 1 — Tell us about your website")).toBe(true);
    expect(source.includes("Step 2 — Connect your site")).toBe(true);
    expect(source.includes("Step 3 — Review your plan")).toBe(true);
    expect(source.includes("Step 4 — Review your pages")).toBe(true);
    expect(source.includes("Step 5 — Build your draft")).toBe(true);
    expect(source.includes("1. Tell us about your website")).toBe(true);
    expect(source.includes("2. Connect your site")).toBe(true);
    expect(source.includes("3. Review your plan")).toBe(true);
    expect(source.includes("4. Review your pages")).toBe(true);
    expect(source.includes("5. Build your draft")).toBe(true);
    expect(source.includes("Website Strategy Brief")).toBe(true);
    expect(source.includes("AI & Research API Configuration")).toBe(true);
    expect(source.includes("WordPress / Thrive Connection")).toBe(true);
    expect(source.includes("Run History")).toBe(true);
    expect(source.includes("Task List")).toBe(false);
  });
});
