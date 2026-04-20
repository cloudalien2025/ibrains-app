import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("front door environment copy contract", () => {
  it("uses architecture-neutral NEXT_PUBLIC_WORKER_URL guidance", () => {
    const sourcePath = path.join(process.cwd(), "app/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("NEXT_PUBLIC_WORKER_URL")).toBe(true);
    expect(source.includes("Vercel env vars")).toBe(false);
    expect(source.includes("in the app environment")).toBe(true);
  });
});
