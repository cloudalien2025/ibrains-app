import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SmokeMockOptions = {
  dashboardRedirectLocation?: string;
  walmartRedirectLocation?: string;
  signInHtml?: string;
};

function buildFrontdoorHtml({ includeAssets }: { includeAssets: boolean }): string {
  if (!includeAssets) {
    return "<!doctype html><html><body><h1>No assets</h1></body></html>";
  }
  return [
    "<!doctype html>",
    "<html>",
    "<head><link rel=\"stylesheet\" href=\"/_next/static/css/app.css\"></head>",
    "<body>",
    "<script src=\"/_next/static/chunks/app.js\"></script>",
    "</body>",
    "</html>",
  ].join("");
}

async function withSmokeMockServer<T>(
  options: SmokeMockOptions,
  run: (baseUrl: string) => Promise<T> | T
): Promise<T> {
  const dashboardRedirectLocation =
    options.dashboardRedirectLocation ??
    "http://app.ibrains.ai/sign-in?redirect_url=http%3A%2F%2Fapp.ibrains.ai%2Fdashboard%2F";
  const walmartRedirectLocation =
    options.walmartRedirectLocation ??
    "http://app.ibrains.ai/sign-in?redirect_url=http%3A%2F%2Fapp.ibrains.ai%2Foptiwal%2Fconnect";
  const signInHtml = options.signInHtml ?? buildFrontdoorHtml({ includeAssets: true });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildFrontdoorHtml({ includeAssets: true }));
      return;
    }

    if (pathname === "/sign-in") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(signInHtml);
      return;
    }

    if (pathname === "/_next/static/chunks/app.js") {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end("console.log('ok');");
      return;
    }

    if (pathname === "/_next/static/css/app.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end("body{background:#fff;}");
      return;
    }

    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      res.writeHead(307, { Location: dashboardRedirectLocation });
      res.end();
      return;
    }

    if (pathname === "/optiwal/connect") {
      res.writeHead(307, { Location: walmartRedirectLocation });
      res.end();
      return;
    }

    if (pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, upstream_ok: true, app_ok: true, deploy_ready: true }));
      return;
    }

    if (pathname === "/api/meta/release") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ release_file: true, build_id: "123", git_sha: "abc123" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function runSmokeScript(baseUrl: string): Promise<{ status: number; output: string }> {
  const smokeScript = path.join(process.cwd(), "scripts/prod_smoke.sh");
  return await new Promise((resolve, reject) => {
    const child = spawn("bash", [smokeScript, "app.ibrains.ai"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SKIP_SERVICE_CHECKS: "1",
        BASE_URL: baseUrl,
        PROTO: "http",
        DOMAIN: "app.ibrains.ai",
        EXPECT_RELEASE_FILE: "1",
        EXPECT_BUILD_ID: "123",
        EXPECT_GIT_SHA: "abc123",
        PUBLIC_SMOKE_PATHS: "/ /sign-in",
        PROTECTED_REDIRECT_PATHS: "/dashboard /optiwal/connect",
      },
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ status: code ?? -1, output });
    });
  });
}

describe("gitlab deploy pipeline contract", () => {
  it("uses GitLab CI as the only tracked production deploy authority and verifies protected redirect smoke checks", () => {
    const pipelineSource = fs.readFileSync(path.join(process.cwd(), ".gitlab-ci.yml"), "utf8");
    const smokeSource = fs.readFileSync(path.join(process.cwd(), "scripts/prod_smoke.sh"), "utf8");
    const githubDeployPath = path.join(process.cwd(), ".github/workflows/deploy_app.yml");

    expect(fs.existsSync(githubDeployPath)).toBe(false);
    expect(pipelineSource.includes("scripts/prod_smoke.sh")).toBe(true);
    expect(pipelineSource.includes("artifacts/build.tar.gz")).toBe(true);
    expect(pipelineSource.includes("scripts/guard-canonical-worktree.sh")).toBe(true);
    expect(pipelineSource.includes("canonical worktree guard script")).toBe(true);
    expect(pipelineSource.includes("scripts/guard-untracked-pull-conflicts.sh")).toBe(true);
    expect(pipelineSource.includes("git fetch --prune origin")).toBe(true);
    expect(pipelineSource.includes("git pull --ff-only origin \"${CI_DEFAULT_BRANCH}\"")).toBe(true);
    expect(pipelineSource.includes("deployed checkout mismatch")).toBe(true);
    expect(pipelineSource.includes("npm run build")).toBe(true);
    expect(pipelineSource.includes("rm -rf .next")).toBe(true);
    expect(pipelineSource.includes("rsync -a --delete")).toBe(false);
    expect(pipelineSource.includes("EXPECT_RELEASE_FILE=1")).toBe(true);
    expect(pipelineSource.includes("PUBLIC_SMOKE_PATHS=\"/ /sign-in\"")).toBe(true);
    expect(pipelineSource.includes("PROTECTED_REDIRECT_PATHS=\"/dashboard /optiwal/connect\"")).toBe(true);
    expect(pipelineSource.includes("BASE_URL=http://127.0.0.1:3001")).toBe(true);
    expect(pipelineSource.includes("HOST_HEADER=app.ibrains.ai")).toBe(true);
    expect(pipelineSource.includes("BASE_URL=https://app.ibrains.ai")).toBe(true);
    expect(pipelineSource.includes("release_probe_url=\"http://127.0.0.1:3001/api/meta/release\"")).toBe(true);
    expect(pipelineSource.includes("release_probe_host=\"${DOMAIN:-app.ibrains.ai}\"")).toBe(true);
    expect(pipelineSource.includes("curl -fsS \"${release_probe_args[@]}\" \"${release_probe_url}\"")).toBe(true);
    expect(pipelineSource.includes("release probe host: ${release_probe_host}")).toBe(true);
    expect(pipelineSource.includes("tail -n 120 /var/log/ibrains-app/app.log")).toBe(true);
    expect(pipelineSource.includes("tail -n 120 /var/log/nginx/app.ibrains.ai.error.log")).toBe(true);
    expect(smokeSource.includes("PUBLIC_SMOKE_PATHS=\"${PUBLIC_SMOKE_PATHS:-/ /sign-in}\"")).toBe(true);
    expect(smokeSource.includes("PROTECTED_REDIRECT_PATHS=\"${PROTECTED_REDIRECT_PATHS:-/dashboard /optiwal/connect}\"")).toBe(true);
    expect(smokeSource.includes("expected 307 protected redirect")).toBe(true);
    expect(smokeSource.includes("must not include localhost:3001")).toBe(true);
    expect(smokeSource.includes("served javascript content-type")).toBe(true);
    expect(smokeSource.includes("served css content-type")).toBe(true);
    expect(smokeSource.includes("health http status:")).toBe(true);
    expect(smokeSource.includes("health body:")).toBe(true);
    expect(smokeSource.includes("health parsed:")).toBe(true);
    expect(smokeSource.includes("release build_id is non-null")).toBe(true);
    expect(smokeSource.includes("release git_sha is non-null")).toBe(true);
  });

  it("passes when protected routes redirect unauthenticated requests to app.ibrains.ai sign-in", async () => {
    await withSmokeMockServer({}, async (baseUrl) => {
      const result = await runSmokeScript(baseUrl);
      expect(result.output).toContain("PASS: /dashboard returned expected 307 protected redirect");
      expect(result.output).toContain(
        "PASS: /optiwal/connect returned expected 307 protected redirect"
      );
    });
  });

  it("fails when protected route redirect contains localhost:3001", async () => {
    await withSmokeMockServer(
      {
        dashboardRedirectLocation:
          "http://app.ibrains.ai/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3001%2Fdashboard%2F",
      },
      async (baseUrl) => {
        const result = await runSmokeScript(baseUrl);
        expect(result.status).not.toBe(0);
        expect(result.output).toContain("FAIL: /dashboard protected redirect invalid: redirect_url must not include localhost:3001");
      }
    );
  });

  it("fails when public route HTML is missing _next/static asset refs", async () => {
    await withSmokeMockServer(
      {
        signInHtml: buildFrontdoorHtml({ includeAssets: false }),
      },
      async (baseUrl) => {
        const result = await runSmokeScript(baseUrl);
        expect(result.status).not.toBe(0);
        expect(result.output).toContain("FAIL: /sign-in HTML has no _next/static asset refs");
      }
    );
  });
});
