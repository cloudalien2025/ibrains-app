import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteforge agency flow and failure language contract", () => {
  it("uses agency IA labels instead of the old simple-step model", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Mission Control")).toBe(true);
    expect(source.includes("Project Mission")).toBe(true);
    expect(source.includes("Agency Team")).toBe(true);
    expect(source.includes("Workstream Progress Board")).toBe(true);
    expect(source.includes("Strategy Director")).toBe(true);
    expect(source.includes("Publish Checklist")).toBe(true);

    expect(source.includes('label: "Connect Site"')).toBe(false);
    expect(source.includes('label: "Done"')).toBe(false);
  });

  it("retains user-friendly failure copy and diagnostics visibility", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("We couldn’t generate your site yet.")).toBe(true);
    expect(source.includes("Your WordPress site connected, but the build failed.")).toBe(true);
    expect(source.includes("Thrive was detected, but the native build path is currently blocked.")).toBe(true);
    expect(source.includes("Raw Errors")).toBe(true);
    expect(source.includes("Diagnostics")).toBe(true);
  });
});
