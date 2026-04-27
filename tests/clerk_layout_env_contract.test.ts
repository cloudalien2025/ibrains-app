import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clerk layout env contract", () => {
  it("keeps the root layout auth-free so the public frontdoor cannot bake placeholder clerk state", () => {
    const sourcePath = path.join(process.cwd(), "app/layout.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("resolveClerkRuntimeContract")).toBe(false);
    expect(source.includes("resolveClerkRouteContract")).toBe(false);
    expect(source.includes("ClerkProvider")).toBe(false);
    expect(source.includes("DEV_PUBLISHABLE_KEY_FALLBACK")).toBe(false);
    expect(source.includes("phase-production-build")).toBe(false);
    expect(source.includes("resolveCurrentReleaseId")).toBe(true);
    expect(source.includes("data-release-id={releaseId ?? undefined}")).toBe(true);
    expect(source.includes("<StaleClientRecovery />")).toBe(true);
    expect(source.includes("{children}")).toBe(true);
  });
});
