import nextConfig from "../next.config.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_SELF_ORIGINS = ["https://localhost:3001", "https://127.0.0.1:3001"];

function listTargetFiles(targetPath, acc) {
  if (!existsSync(targetPath)) return;
  const stat = statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(targetPath)) {
      listTargetFiles(join(targetPath, entry), acc);
    }
    return;
  }
  acc.push(targetPath);
}

function assertNoForbiddenSelfOriginsInSource() {
  const files = [];
  listTargetFiles("app", files);
  listTargetFiles("lib", files);
  listTargetFiles("components", files);
  listTargetFiles("next.config.mjs", files);
  listTargetFiles("proxy.ts", files);
  listTargetFiles("middleware.ts", files);

  const matches = [];
  for (const filePath of files) {
    const body = readFileSync(filePath, "utf8");
    for (const forbidden of FORBIDDEN_SELF_ORIGINS) {
      if (body.includes(forbidden)) {
        matches.push(`${filePath}: ${forbidden}`);
      }
    }
  }

  if (matches.length > 0) {
    console.error("Forbidden HTTPS localhost self-origin found in source/config:");
    for (const match of matches) console.error(match);
    process.exit(1);
  }
}

const asJson = JSON.stringify(nextConfig);

const hasForbiddenSelfOrigin = /https:\/\/(?:localhost|127\.0\.0\.1):3001/i.test(asJson);
if (hasForbiddenSelfOrigin) {
  console.error("Forbidden HTTPS localhost self-origin found in next config.");
  process.exit(1);
}

const allowedOrigins = nextConfig.experimental?.serverActions?.allowedOrigins ?? [];
if (!Array.isArray(allowedOrigins) || !allowedOrigins.includes("app.ibrains.ai")) {
  console.error("next.config.mjs must include experimental.serverActions.allowedOrigins=['app.ibrains.ai'].");
  process.exit(1);
}

if (allowedOrigins.some((value) => /localhost|127\.0\.0\.1/i.test(value))) {
  console.error("Server Actions allowed origins must not contain localhost/private loopback.");
  process.exit(1);
}

assertNoForbiddenSelfOriginsInSource();

console.log("Next origin guard passed.");
