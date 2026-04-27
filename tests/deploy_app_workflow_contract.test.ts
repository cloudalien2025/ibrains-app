import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy app workflow contract", () => {
  it("ships the postinstall patch script in the deployment artifact and verifies both localhost and public release health", () => {
    const workflowSource = fs.readFileSync(path.join(process.cwd(), ".github/workflows/deploy_app.yml"), "utf8");
    const smokeSource = fs.readFileSync(path.join(process.cwd(), "scripts/prod_smoke.sh"), "utf8");

    expect(workflowSource.includes("npm ci --omit=dev")).toBe(true);
    expect(workflowSource.includes("scripts/prod_smoke.sh")).toBe(true);
    expect(workflowSource.includes("scripts/patch_next_route_types.mjs")).toBe(true);
    expect(workflowSource.includes("db/directoryiq/001_directoryiq_schema_from_shared.sql")).toBe(true);
    expect(workflowSource.includes("scripts/apply_directoryiq_schema.sh")).toBe(true);
    expect(workflowSource.includes("bash \"${RELEASE_DIR}/scripts/apply_directoryiq_schema.sh\"")).toBe(true);
    expect(workflowSource.includes("EXPECT_RELEASE_FILE=1")).toBe(true);
    expect(workflowSource.includes("EXPECT_BUILD_ID=\"${GITHUB_RUN_ID}\"")).toBe(true);
    expect(workflowSource.includes("EXPECT_GIT_SHA=\"${GITHUB_SHA}\"")).toBe(true);
    expect(workflowSource.includes("SMOKE_PATHS=\"/ /sign-in\"")).toBe(true);
    expect(workflowSource.includes("BASE_URL=http://127.0.0.1:3001")).toBe(true);
    expect(workflowSource.includes("HOST_HEADER=app.ibrains.ai")).toBe(true);
    expect(workflowSource.includes("BASE_URL=https://app.ibrains.ai")).toBe(true);
    expect(workflowSource.includes("tail -n 120 /var/log/nginx/app.ibrains.ai.error.log")).toBe(true);
    expect(smokeSource.includes("SMOKE_PATHS")).toBe(true);
    expect(smokeSource.includes("/sign-in")).toBe(true);
  });
});
