import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

type ReleaseFile = {
  build_id?: string;
  git_sha_short?: string;
  git_sha?: string;
};

const releaseFilePath = path.join(process.cwd(), "app", "_meta", "release.json");

function cleanValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function readReleaseIdFromFile() {
  try {
    const raw = await readFile(releaseFilePath, "utf-8");
    const releaseFile = JSON.parse(raw) as ReleaseFile;

    return cleanValue(releaseFile.build_id) || cleanValue(releaseFile.git_sha_short) || cleanValue(releaseFile.git_sha);
  } catch {
    return null;
  }
}

export async function resolveCurrentReleaseId() {
  const env = process.env;

  return (
    cleanValue(env.RELEASE_BUILD_ID) ||
    cleanValue(env.BUILD_ID) ||
    cleanValue(env.GITHUB_RUN_ID) ||
    cleanValue(env.RELEASE_GIT_SHA_SHORT) ||
    cleanValue(env.RELEASE_GIT_SHA) ||
    (await readReleaseIdFromFile())
  );
}
