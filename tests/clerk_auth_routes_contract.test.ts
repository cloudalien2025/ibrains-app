import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clerk auth route contract", () => {
  it("keeps path-based sign-in route and applies shared route env contract", () => {
    const signInPath = path.join(process.cwd(), "app/sign-in/[[...sign-in]]/page.tsx");
    const source = fs.readFileSync(signInPath, "utf8");

    expect(source.includes("resolveClerkRuntimeContract")).toBe(true);
    expect(source.includes("resolveClerkRouteContract")).toBe(true);
    expect(source.includes("routing=\"path\"")).toBe(true);
    expect(source.includes("path={routeContract.signInUrl}")).toBe(true);
    expect(source.includes("signUpUrl={routeContract.signUpUrl}")).toBe(true);
    expect(source.includes("fallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}")).toBe(true);
    expect(source.includes("Clerk auth is not configured.")).toBe(true);
  });

  it("keeps path-based sign-up route and applies shared route env contract", () => {
    const signUpPath = path.join(process.cwd(), "app/sign-up/[[...sign-up]]/page.tsx");
    const source = fs.readFileSync(signUpPath, "utf8");

    expect(source.includes("resolveClerkRuntimeContract")).toBe(true);
    expect(source.includes("resolveClerkRouteContract")).toBe(true);
    expect(source.includes("routing=\"path\"")).toBe(true);
    expect(source.includes("path={routeContract.signUpUrl}")).toBe(true);
    expect(source.includes("signInUrl={routeContract.signInUrl}")).toBe(true);
    expect(source.includes("fallbackRedirectUrl={routeContract.signUpFallbackRedirectUrl}")).toBe(true);
    expect(source.includes("Clerk auth is not configured.")).toBe(true);
  });
});
