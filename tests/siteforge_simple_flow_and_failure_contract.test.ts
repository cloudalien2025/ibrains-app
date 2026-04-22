import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge 2050 flow and failure language contract", () => {
  it("enforces the six-screen flow", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("function renderIntentScreen()")).toBe(true);
    expect(source.includes("function renderConnectScreen()")).toBe(true);
    expect(source.includes("function renderPreviewScreen()")).toBe(true);
    expect(source.includes("function renderApproveScreen()")).toBe(true);
    expect(source.includes("function renderBuildScreen()")).toBe(true);
    expect(source.includes("function renderLaunchScreen()")).toBe(true);
  });

  it("keeps plain-language build states and user-friendly errors", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Preparing")).toBe(true);
    expect(source.includes("Building")).toBe(true);
    expect(source.includes("Verifying")).toBe(true);
    expect(source.includes("Ready")).toBe(true);
    expect(source.includes("Needs your input")).toBe(true);

    expect(source.includes("We couldn’t generate your site yet.")).toBe(true);
    expect(source.includes("Your WordPress site connected, but the build failed.")).toBe(true);
    expect(source.includes("buildModeUsed")).toBe(false);
    expect(source.includes("thrive_fallback")).toBe(false);
    expect(source.includes("wordpress_fallback")).toBe(false);
  });
});
