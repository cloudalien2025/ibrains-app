import { describe, expect, it } from "vitest";
import {
  buildClerkProductionConfigError,
  resolveClerkRouteContract,
  resolveClerkRuntimeContract,
} from "@/lib/auth/clerkEnvContract";

describe("clerk shared env contract", () => {
  it("allows dev fallback publishable key outside production", () => {
    const contract = resolveClerkRuntimeContract({ NODE_ENV: "development" });

    expect(contract.effectivePublishableKey).toBe("pk_test_ibrains_missing_publishable_key");
    expect(contract.configuredForProxy).toBe(false);
    expect(contract.hasProductionConfigError).toBe(false);
  });

  it("does not allow placeholder publishable key in production", () => {
    const contract = resolveClerkRuntimeContract({ NODE_ENV: "production", CLERK_SECRET_KEY: "sk_live_x" });

    expect(contract.effectivePublishableKey).toBeUndefined();
    expect(contract.hasProductionConfigError).toBe(true);
    expect(buildClerkProductionConfigError(contract)).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY");
  });

  it("marks proxy configured only when publishable and secret keys match contract rules", () => {
    const configured = resolveClerkRuntimeContract({
      NODE_ENV: "production",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
      CLERK_SECRET_KEY: "sk_live_x",
    });
    const missingSecret = resolveClerkRuntimeContract({
      NODE_ENV: "production",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
    });

    expect(configured.configuredForProxy).toBe(true);
    expect(configured.hasProductionConfigError).toBe(false);
    expect(missingSecret.configuredForProxy).toBe(false);
    expect(missingSecret.hasProductionConfigError).toBe(true);
  });

  it("normalizes sign-in and sign-up route env values", () => {
    const routes = resolveClerkRouteContract({
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/register",
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "runs",
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/mission-control",
    });

    expect(routes.signInUrl).toBe("/sign-in");
    expect(routes.signUpUrl).toBe("/register");
    expect(routes.signInFallbackRedirectUrl).toBe("/runs");
    expect(routes.signUpFallbackRedirectUrl).toBe("/mission-control");
  });

  it("defaults sign-in and sign-up fallback redirects to /brains", () => {
    const routes = resolveClerkRouteContract({});

    expect(routes.signInFallbackRedirectUrl).toBe("/brains");
    expect(routes.signUpFallbackRedirectUrl).toBe("/brains");
  });

  it("sanitizes deprecated legacy fallback redirects back to /brains", () => {
    const routes = resolveClerkRouteContract({
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/apps/studio",
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/siteforge",
    });

    expect(routes.signInFallbackRedirectUrl).toBe("/brains");
    expect(routes.signUpFallbackRedirectUrl).toBe("/brains");
  });
});
