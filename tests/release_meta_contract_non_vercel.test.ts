import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release meta non-vercel contract", () => {
  it("does not derive release metadata from Vercel env vars", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/api/meta/release/route.ts"), "utf8");

    expect(source.includes("env.VERCEL_ENV")).toBe(false);
    expect(source.includes("env.VERCEL_GIT_COMMIT_SHA")).toBe(false);
    expect(source.includes("env.GITHUB_SHA")).toBe(true);
  });
});
