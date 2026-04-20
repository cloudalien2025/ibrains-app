import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clerk layout env contract", () => {
  it("uses NEXT_PUBLIC or server publishable key for ClerkProvider", () => {
    const sourcePath = path.join(process.cwd(), "app/layout.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY")).toBe(true);
    expect(source.includes("pk_test_ibrains_missing_publishable_key")).toBe(true);
    expect(source.includes("<ClerkProvider publishableKey={effectivePublishableKey}>")).toBe(true);
  });
});
