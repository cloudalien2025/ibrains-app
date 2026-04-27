import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("gitlab deploy pipeline contract", () => {
  it("uses GitLab CI as the only tracked production deploy authority and verifies frontdoor assets", () => {
    const pipelineSource = fs.readFileSync(path.join(process.cwd(), ".gitlab-ci.yml"), "utf8");
    const smokeSource = fs.readFileSync(path.join(process.cwd(), "scripts/prod_smoke.sh"), "utf8");
    const githubDeployPath = path.join(process.cwd(), ".github/workflows/deploy_app.yml");

    expect(fs.existsSync(githubDeployPath)).toBe(false);
    expect(pipelineSource.includes("scripts/prod_smoke.sh")).toBe(true);
    expect(pipelineSource.includes("artifacts/build.tar.gz")).toBe(true);
    expect(pipelineSource.includes("EXPECT_RELEASE_FILE=1")).toBe(true);
    expect(pipelineSource.includes("SMOKE_PATHS=\"/ /apps /sign-in\"")).toBe(true);
    expect(pipelineSource.includes("BASE_URL=http://127.0.0.1:3001")).toBe(true);
    expect(pipelineSource.includes("HOST_HEADER=app.ibrains.ai")).toBe(true);
    expect(pipelineSource.includes("BASE_URL=https://app.ibrains.ai")).toBe(true);
    expect(pipelineSource.includes("tail -n 120 /var/log/nginx/app.ibrains.ai.error.log")).toBe(true);
    expect(smokeSource.includes("SMOKE_PATHS=\"${SMOKE_PATHS:-/ /apps /sign-in}\"")).toBe(true);
    expect(smokeSource.includes("served javascript content-type")).toBe(true);
    expect(smokeSource.includes("served css content-type")).toBe(true);
  });
});
