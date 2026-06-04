import nextConfig from "../next.config.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_SELF_ORIGINS = ["https://localhost:3001", "https://127.0.0.1:3001"];
const LOCALHOST_PATTERN = /(?:^|[^a-z0-9])(localhost|127\.0\.0\.1)(?::\d+)?(?:$|[^a-z0-9])/i;

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

function normalizeEnvValue(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function assertNoLocalhostClerkProxyEnv() {
  const envPath = ".env.production.local";
  const values = [];

  if (existsSync(envPath)) {
    const body = readFileSync(envPath, "utf8");
    const lines = body.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [rawKey, ...rawValueParts] = trimmed.split("=");
      const key = rawKey?.trim();
      if (key !== "NEXT_PUBLIC_CLERK_PROXY_URL") continue;
      const value = normalizeEnvValue(rawValueParts.join("="));
      values.push(value);
    }
  }

  if (process.env.NEXT_PUBLIC_CLERK_PROXY_URL) {
    values.push(process.env.NEXT_PUBLIC_CLERK_PROXY_URL.trim());
  }

  for (const value of values) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (LOCALHOST_PATTERN.test(parsed.hostname)) {
        console.error("NEXT_PUBLIC_CLERK_PROXY_URL must not point to localhost/127.0.0.1.");
        process.exit(1);
      }
    } catch {
      if (LOCALHOST_PATTERN.test(value)) {
        console.error("NEXT_PUBLIC_CLERK_PROXY_URL must not point to localhost/127.0.0.1.");
        process.exit(1);
      }
    }
  }
}

function assertNoLocalhostClerkProviderOverrides() {
  const providerPath = "components/auth/configured-clerk-provider.tsx";
  if (!existsSync(providerPath)) return;

  const source = readFileSync(providerPath, "utf8");
  const riskyProps = ["domain", "isSatellite", "forceRedirectUrl"];

  for (const prop of riskyProps) {
    const localhostWithProp = new RegExp(`${prop}\\s*[:=][^\\n]*localhost`, "i");
    const loopbackWithProp = new RegExp(`${prop}\\s*[:=][^\\n]*127\\.0\\.0\\.1`, "i");
    if (localhostWithProp.test(source) || loopbackWithProp.test(source)) {
      console.error(`ClerkProvider ${prop} must not use localhost/127.0.0.1.`);
      process.exit(1);
    }
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
assertNoLocalhostClerkProxyEnv();
assertNoLocalhostClerkProviderOverrides();

console.log("Next origin guard passed.");
