import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy app workflow contract", () => {
  it("ships the postinstall patch script in the deployment artifact and verifies both localhost and public release health", () => {
    const source = fs.readFileSync(path.join(process.cwd(), ".github/workflows/deploy_app.yml"), "utf8");

    expect(source.includes("npm ci --omit=dev")).toBe(true);
    expect(source.includes("scripts/prod_smoke.sh")).toBe(true);
    expect(source.includes("scripts/patch_next_route_types.mjs")).toBe(true);
    expect(source.includes("EXPECT_RELEASE_FILE=1")).toBe(true);
    expect(source.includes("EXPECT_BUILD_ID=\"${GITHUB_RUN_ID}\"")).toBe(true);
    expect(source.includes("EXPECT_GIT_SHA=\"${GITHUB_SHA}\"")).toBe(true);
    expect(source.includes("BASE_URL=http://127.0.0.1:3001")).toBe(true);
    expect(source.includes("HOST_HEADER=app.ibrains.ai")).toBe(true);
    expect(source.includes("BASE_URL=https://app.ibrains.ai")).toBe(true);
    expect(source.includes("tail -n 120 /var/log/nginx/app.ibrains.ai.error.log")).toBe(true);
  });
});
