import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 flow and failure language contract", () => {
  it("enforces the three-step flow", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("function renderConnectStep()")).toBe(true);
    expect(source.includes("function renderDescribeStep()")).toBe(true);
    expect(source.includes("function renderLaunchStep()")).toBe(true);
    expect(source.includes("function renderPreviewScreen()")).toBe(false);
    expect(source.includes("function renderApproveScreen()")).toBe(false);
    expect(source.includes("function renderBuildScreen()")).toBe(false);
  });

  it("keeps plain-language launch states and user-friendly errors", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Researching your market")).toBe(true);
    expect(source.includes("Planning your pages")).toBe(true);
    expect(source.includes("Building in Thrive")).toBe(true);
    expect(source.includes("Verifying your draft")).toBe(true);
    expect(source.includes("Ready to build")).toBe(true);
    expect(source.includes("Draft ready")).toBe(true);
    expect(source.includes("Needs your input")).toBe(false);
    expect(source.includes("Approve your homepage")).toBe(false);

    expect(source.includes("We couldn’t generate your site yet.")).toBe(true);
    expect(source.includes("Your WordPress site connected, but the build failed.")).toBe(true);
    expect(source.includes("buildModeUsed")).toBe(true);
    expect(source.includes("thrive_fallback")).toBe(false);
    expect(source.includes("wordpress_fallback")).toBe(false);
  });
});
