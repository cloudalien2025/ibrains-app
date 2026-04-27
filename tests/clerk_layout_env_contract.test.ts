import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clerk layout env contract", () => {
  it("uses shared clerk runtime contract and fails truthfully when production env is broken", () => {
    const sourcePath = path.join(process.cwd(), "app/layout.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("resolveClerkRuntimeContract")).toBe(true);
    expect(source.includes("resolveClerkRouteContract")).toBe(true);
    expect(source.includes("if (runtimeContract.hasProductionConfigError && !isProductionBuildPhase)")).toBe(true);
    expect(source.includes("throw new Error(buildClerkProductionConfigError(runtimeContract));")).toBe(true);
    expect(source.includes("DEV_PUBLISHABLE_KEY_FALLBACK")).toBe(true);
    expect(source.includes("resolveCurrentReleaseId")).toBe(true);
    expect(source.includes("data-release-id={releaseId ?? undefined}")).toBe(true);
    expect(source.includes("<StaleClientRecovery />")).toBe(true);
    expect(source.includes("signInFallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}")).toBe(true);
  });
});
