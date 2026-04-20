import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clerk auth route contract", () => {
  it("keeps path-based sign-in route and handles missing publishable key safely", () => {
    const signInPath = path.join(process.cwd(), "app/sign-in/[[...sign-in]]/page.tsx");
    const source = fs.readFileSync(signInPath, "utf8");

    expect(source.includes("<SignIn routing=\"path\" path=\"/sign-in\" signUpUrl=\"/sign-up\" />")).toBe(true);
    expect(source.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")).toBe(true);
    expect(source.includes("CLERK_PUBLISHABLE_KEY")).toBe(true);
    expect(source.includes("Clerk auth is not configured.")).toBe(true);
  });

  it("keeps path-based sign-up route and handles missing publishable key safely", () => {
    const signUpPath = path.join(process.cwd(), "app/sign-up/[[...sign-up]]/page.tsx");
    const source = fs.readFileSync(signUpPath, "utf8");

    expect(source.includes("<SignUp routing=\"path\" path=\"/sign-up\" signInUrl=\"/sign-in\" />")).toBe(true);
    expect(source.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")).toBe(true);
    expect(source.includes("CLERK_PUBLISHABLE_KEY")).toBe(true);
    expect(source.includes("Clerk auth is not configured.")).toBe(true);
  });
});
