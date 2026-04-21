import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge first-time user journey UI contract", () => {
  it("uses simplified Setup/Build/Publish IA with Build sub-tabs", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Setup"')).toBe(true);
    expect(source.includes('label: "Build"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes('["plan", "Plan"]')).toBe(true);
    expect(source.includes('["pages", "Pages"]')).toBe(true);
    expect(source.includes('["assets", "Assets"]')).toBe(true);

    expect(source.includes('label: "Review"')).toBe(false);
    expect(source.includes('label: "Thrive Assets"')).toBe(false);
    expect(source.includes('label: "Settings"')).toBe(false);

    expect(source.includes("About your website")).toBe(true);
    expect(source.includes("Connect your site")).toBe(true);
    expect(source.includes("AI access")).toBe(true);
    expect(source.includes("Connection result")).toBe(true);
    expect(source.includes("Save and Continue")).toBe(true);
    expect(source.includes("Check Connection")).toBe(true);
    expect(source.includes("Continue to Build")).toBe(true);
    expect(source.includes("Looks Good")).toBe(true);
    expect(source.includes("Approve Page")).toBe(true);
    expect(source.includes("Review Build Status")).toBe(true);
    expect(source.includes("Rescan Assets")).toBe(true);
    expect(source.includes("Ask SiteForge")).toBe(false);
    expect(source.includes("Builder Feed")).toBe(false);
    expect(source.includes("Build can only be started from Build.")).toBe(true);
    expect(source.includes('activeNav === "publish" ? "BuildDraft"')).toBe(false);
    expect(source.includes('activeNav === "publish" ? "Build Draft"')).toBe(false);
    expect(source.includes(">Build Draft<")).toBe(false);

    expect(source.includes("Build")).toBe(true);
    expect(source.includes("Pages")).toBe(true);
    expect(source.includes("Publish")).toBe(true);
  });
});
