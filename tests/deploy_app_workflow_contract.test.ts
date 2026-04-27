import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy app workflow contract", () => {
  it("ships the postinstall patch script in the deployment artifact", () => {
    const source = fs.readFileSync(path.join(process.cwd(), ".github/workflows/deploy_app.yml"), "utf8");

    expect(source.includes("npm ci --omit=dev")).toBe(true);
    expect(source.includes("scripts/prod_smoke.sh")).toBe(true);
    expect(source.includes("scripts/patch_next_route_types.mjs")).toBe(true);
  });
});
