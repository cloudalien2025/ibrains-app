import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("frontdoor public route auth isolation", () => {
  it("keeps the homepage free of clerk client hooks and placeholder auth state", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");

    expect(source.includes("\"use client\"")).toBe(false);
    expect(source.includes("FrontdoorHeaderActions")).toBe(true);
    expect(source.includes("useAuth(")).toBe(false);
    expect(source.includes("UserButton")).toBe(false);
    expect(source.includes("NEXT_PUBLIC_CLERK")).toBe(false);
    expect(source.includes("pk_test_ibrains_missing_publishable_key")).toBe(false);
  });

  it("keeps the app launcher free of clerk client hooks so it can prerender safely", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/apps/page.tsx"), "utf8");

    expect(source.includes("\"use client\"")).toBe(false);
    expect(source.includes("FrontdoorHeaderActions")).toBe(true);
    expect(source.includes("useAuth(")).toBe(false);
    expect(source.includes("UserButton")).toBe(false);
    expect(source.includes("ClerkProvider")).toBe(false);
  });

  it("forces the protected shell to render at runtime so production builds do not require clerk secrets", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/(shell)/layout.tsx"), "utf8");

    expect(source.includes("export const dynamic = \"force-dynamic\";")).toBe(true);
    expect(source.includes("runtimeContract.hasProductionConfigError")).toBe(true);
  });
});
