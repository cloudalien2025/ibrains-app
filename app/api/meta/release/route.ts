import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";

type ReleaseFile = {
  service?: string;
  environment?: string;
  git_sha?: string;
  git_sha_short?: string;
  build_timestamp?: string;
  build_id?: string;
  source?: string;
};

const releaseFilePath = path.join(process.cwd(), "app", "_meta", "release.json");
const execFileAsync = promisify(execFile);

const cleanValue = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export async function GET() {
  try {
    let releaseFile: ReleaseFile | null = null;
    try {
      const raw = await readFile(releaseFilePath, "utf-8");
      releaseFile = JSON.parse(raw) as ReleaseFile;
    } catch {
      releaseFile = null;
    }

    const env = process.env;

    const envService = cleanValue(env.APP_NAME) || cleanValue(env.SERVICE_NAME);
    const fileService = cleanValue(releaseFile?.service);
    const service = envService || fileService || "ibrains";

    const envEnvironmentExplicit = cleanValue(env.APP_ENV);
    const envEnvironmentFallback = cleanValue(env.NODE_ENV);
    const fileEnvironment = cleanValue(releaseFile?.environment);
    const environment = envEnvironmentExplicit || fileEnvironment || envEnvironmentFallback || "local";

    const envGitSha =
      cleanValue(env.RELEASE_GIT_SHA) || cleanValue(env.GIT_SHA) || cleanValue(env.GITHUB_SHA);
    const fileGitSha = cleanValue(releaseFile?.git_sha);
    let gitSha = envGitSha || fileGitSha;
    if (!gitSha) {
      try {
        const result = await execFileAsync("git", ["rev-parse", "HEAD"], {
          cwd: process.cwd(),
          timeout: 900,
        });
        gitSha = cleanValue(result.stdout);
      } catch {
        gitSha = null;
      }
    }

    const envGitShaShort = cleanValue(env.RELEASE_GIT_SHA_SHORT);
    const fileGitShaShort = cleanValue(releaseFile?.git_sha_short);
    const gitShaShort = envGitShaShort || (gitSha ? gitSha.slice(0, 7) : null) || fileGitShaShort;

    const envBuildTimestamp =
      cleanValue(env.RELEASE_BUILD_TIMESTAMP) || cleanValue(env.BUILD_TIMESTAMP);
    const fileBuildTimestamp = cleanValue(releaseFile?.build_timestamp);
    const buildTimestamp = envBuildTimestamp || fileBuildTimestamp || null;

    const envBuildId =
      cleanValue(env.RELEASE_BUILD_ID) || cleanValue(env.BUILD_ID) || cleanValue(env.GITHUB_RUN_ID);
    const fileBuildId = cleanValue(releaseFile?.build_id);
    const buildId = envBuildId || fileBuildId || gitShaShort || "unavailable";
    const missing: string[] = [];
    if (!gitSha) missing.push("git_sha");
    if (!buildTimestamp) missing.push("build_timestamp");
    if (!envBuildId && !fileBuildId) missing.push("build_id");

    const payload = {
      service,
      environment,
      git_sha: gitSha || "unavailable",
      git_sha_short: gitShaShort || "unavailable",
      build_timestamp: buildTimestamp,
      build_id: buildId,
      local: environment === "local" || environment === "development" || environment === "test",
      diagnostics: {
        missing,
        release_metadata_complete: missing.length === 0,
      },
      sources: {
        git_sha: envGitSha ? "env" : fileGitSha ? "file" : gitSha ? "git" : "missing",
        build_timestamp: envBuildTimestamp ? "env" : fileBuildTimestamp ? "file" : "missing",
        build_id: envBuildId ? "env" : fileBuildId ? "file" : gitShaShort ? "sha_fallback" : "missing",
        environment: envEnvironmentExplicit ? "env" : fileEnvironment ? "file" : envEnvironmentFallback ? "env" : "default",
        service: envService ? "env" : fileService ? "file" : "default",
      },
      release_file: Boolean(releaseFile),
      release_file_source: releaseFile?.source || null,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "release endpoint failure",
        message: String(err),
      },
      { status: 500 }
    );
  }
}
