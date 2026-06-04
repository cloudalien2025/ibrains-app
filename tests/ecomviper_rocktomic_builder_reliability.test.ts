import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RocktomicBuildTracer,
  createRocktomicBuildId,
  promoteBuildDirectoryToLatest,
  resolveRocktomicBuildConfig,
  writeArtifactsToDirectory,
} from "@/lib/ecomviper/suppliers/rocktomic-build-runtime";

describe("rocktomic builder reliability runtime", () => {
  it("parses env config flags and bounds", () => {
    const config = resolveRocktomicBuildConfig({
      ROCKTOMIC_BUILD_STAGE_TIMEOUT_MS: "1111",
      ROCKTOMIC_BUILD_TOTAL_TIMEOUT_MS: "2222",
      ROCKTOMIC_BUILD_ASSET_CONCURRENCY: "99",
      ROCKTOMIC_BUILD_NETWORK_TIMEOUT_MS: "3333",
      ROCKTOMIC_BUILD_FORCE_REFRESH: "1",
      ROCKTOMIC_BUILD_DRY_RUN: "true",
    });

    expect(config.stageTimeoutMs).toBe(1111);
    expect(config.totalTimeoutMs).toBe(2222);
    expect(config.assetConcurrency).toBe(10);
    expect(config.networkTimeoutMs).toBe(3333);
    expect(config.aiExtractionMode).toBe("force");
    expect(config.forceRefresh).toBe(true);
    expect(config.dryRun).toBe(true);
  });

  it("tracks stage timing and failures", async () => {
    const tracer = new RocktomicBuildTracer(resolveRocktomicBuildConfig({ ROCKTOMIC_BUILD_STAGE_TIMEOUT_MS: "100" }));

    await tracer.stage("quick_stage", async () => {
      return 1;
    });

    await expect(
      tracer.stage("failing_stage", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const report = tracer.report("failed", createRocktomicBuildId());
    expect(report.stages.some((stage) => stage.name === "quick_stage" && stage.status === "success")).toBe(true);
    expect(report.stages.some((stage) => stage.name === "failing_stage" && stage.status === "failed")).toBe(true);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("promotes build outputs to latest on success", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-build-success-"));
    const packageDir = path.join(tempRoot, "package");
    const buildDir = path.join(packageDir, "builds", "20260601T000000Z");
    const latestDir = path.join(packageDir, "latest");

    await writeArtifactsToDirectory(buildDir, {
      "validation-report.json": "{\"status\":\"ok\"}",
      "assets.json": "[]",
    });
    await writeArtifactsToDirectory(latestDir, {
      "validation-report.json": "{\"status\":\"old\"}",
      "assets.json": "[1]",
    });

    await promoteBuildDirectoryToLatest({
      packageDir,
      buildDir,
      buildId: "20260601T000000Z",
      artifactFileNames: ["validation-report.json", "assets.json"],
    });

    const latestValidation = await fs.readFile(path.join(packageDir, "latest", "validation-report.json"), "utf8");
    const latestAssets = await fs.readFile(path.join(packageDir, "latest", "assets.json"), "utf8");
    expect(latestValidation).toContain("ok");
    expect(latestAssets).toBe("[]");
  });

  it("does not destroy previous latest artifacts when promotion fails", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rocktomic-build-failure-"));
    const packageDir = path.join(tempRoot, "package");
    const buildDir = path.join(packageDir, "builds", "20260601T000001Z");
    const latestDir = path.join(packageDir, "latest");

    await writeArtifactsToDirectory(buildDir, {
      "validation-report.json": "{\"status\":\"new\"}",
    });
    await writeArtifactsToDirectory(latestDir, {
      "validation-report.json": "{\"status\":\"old\"}",
      "assets.json": "[\"old\"]",
    });

    await expect(
      promoteBuildDirectoryToLatest({
        packageDir,
        buildDir,
        buildId: "20260601T000001Z",
        artifactFileNames: ["validation-report.json", "assets.json"],
      })
    ).rejects.toThrow();

    const latestValidation = await fs.readFile(path.join(packageDir, "latest", "validation-report.json"), "utf8");
    const latestAssets = await fs.readFile(path.join(packageDir, "latest", "assets.json"), "utf8");
    expect(latestValidation).toContain("old");
    expect(latestAssets).toContain("old");
  });
});
