import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge simple flow and failure language contract", () => {
  it("keeps simple step labels and removes old developer-heavy IA labels", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('label: "Connect Site"')).toBe(true);
    expect(source.includes('label: "Tell Us About Your Business"')).toBe(true);
    expect(source.includes('label: "Generate Site"')).toBe(true);
    expect(source.includes('label: "Review Pages"')).toBe(true);
    expect(source.includes('label: "Publish"')).toBe(true);
    expect(source.includes('label: "Done"')).toBe(true);

    expect(source.includes("Mission Control")).toBe(false);
    expect(source.includes("normalizePageApprovalName")).toBe(true);
    expect(source.includes("Publish readiness")).toBe(false);
    expect(source.includes("Strategy Director")).toBe(false);
  });

  it("surfaces user-friendly failure copy and keeps technical details in Advanced", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("We couldn’t generate your site yet.")).toBe(true);
    expect(source.includes("Your WordPress site connected, but the build failed.")).toBe(true);
    expect(source.includes("Thrive was detected, but the native build path is currently blocked.")).toBe(true);
    expect(source.includes("We created some pages, but a few steps still need attention.")).toBe(true);
    expect(source.includes("Raw Errors")).toBe(true);
    expect(source.includes("Diagnostics")).toBe(true);
  });
});
