import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq runtime stamp contract", () => {
  it("uses non-Vercel release env candidates", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/directoryiq/_utils/runtimeStamp.ts"),
      "utf8"
    );

    expect(source.includes("process.env.RELEASE_GIT_SHA")).toBe(true);
    expect(source.includes("process.env.GIT_SHA")).toBe(true);
    expect(source.includes("process.env.GITHUB_SHA")).toBe(true);
    expect(source.includes("VERCEL_GIT_COMMIT_SHA")).toBe(false);
    expect(source.includes("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA")).toBe(false);
  });
});
