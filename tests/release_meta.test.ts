import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GET } from "@/app/api/meta/release/route";

const releaseFilePath = path.join(process.cwd(), "app", "_meta", "release.json");
const originalEnv = { ...process.env };

describe("GET /api/meta/release", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(releaseFilePath, { force: true });
  });

  it("returns deterministic values from env when provided", async () => {
    process.env.APP_NAME = "ibrains";
    process.env.APP_ENV = "staging";
    process.env.RELEASE_GIT_SHA = "abc1234567890defabc1234567890defabc12345";
    process.env.RELEASE_BUILD_TIMESTAMP = "2026-03-08T00:00:00Z";
    process.env.RELEASE_BUILD_ID = "run-777";

    const response = await GET();
    const payload = await response.json();

    expect(payload).toMatchObject({
      service: "ibrains",
      environment: "staging",
      git_sha: "abc1234567890defabc1234567890defabc12345",
      git_sha_short: "abc1234",
      build_timestamp: "2026-03-08T00:00:00Z",
      build_id: "run-777",
      local: false,
      sources: {
        git_sha: "env",
        build_timestamp: "env",
        build_id: "env",
      },
    });
  });

  it("falls back to release file when env is missing", async () => {
    delete process.env.APP_ENV;
    delete process.env.RELEASE_GIT_SHA;
    delete process.env.RELEASE_BUILD_TIMESTAMP;
    delete process.env.RELEASE_BUILD_ID;
    process.env.GITHUB_RUN_ID = "run-999";

    await mkdir(path.dirname(releaseFilePath), { recursive: true });
    await writeFile(
      releaseFilePath,
      JSON.stringify(
        {
          service: "ibrains",
          environment: "production",
          git_sha: "def9876543210cba9876543210cba9876543210",
          git_sha_short: "def9876",
          build_timestamp: "2026-03-07T23:59:00Z",
          build_id: "run-888",
          source: "test_file",
        },
        null,
        2
      ),
      "utf-8"
    );

    const response = await GET();
    const payload = await response.json();

    expect(payload).toMatchObject({
      service: "ibrains",
      environment: "production",
      git_sha: "def9876543210cba9876543210cba9876543210",
      git_sha_short: "def9876",
      build_timestamp: "2026-03-07T23:59:00Z",
      build_id: "run-999",
      local: false,
      release_file: true,
      release_file_source: "test_file",
      sources: {
        git_sha: "file",
        build_timestamp: "file",
        build_id: "env",
      },
    });
  });
});
