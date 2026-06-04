import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("front door layout chain contract", () => {
  it("keeps global stylesheet import and body shell wiring in root layout without global clerk bootstrap", () => {
    const sourcePath = path.join(process.cwd(), "app/layout.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("import \"./globals.css\";")).toBe(true);
    expect(source.includes("<body className=\"antialiased\" data-release-id={releaseId ?? undefined}>")).toBe(true);
    expect(source.includes("<StaleClientRecovery />")).toBe(true);
    expect(source.includes("<ClerkProvider")).toBe(false);
    expect(source.includes("{children}")).toBe(true);
  });
});
