import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

export interface RocktomicBuildConfig {
  stageTimeoutMs: number;
  totalTimeoutMs: number;
  assetConcurrency: number;
  networkTimeoutMs: number;
  aiExtractionMode: "incremental" | "force" | "skip";
  forceRefresh: boolean;
  skipAiExtraction: boolean;
  dryRun: boolean;
}

export interface RocktomicBuildStageReport {
  name: string;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  recordsProcessed?: number;
  notes: string[];
  error?: string;
}

export interface RocktomicBuildTimingReport {
  supplierSlug: "rocktomic";
  generatedAt: string;
  command: "ecomviper:build-rocktomic-supplier-data";
  status: "success" | "failed";
  buildId: string;
  totalDurationMs: number;
  stages: RocktomicBuildStageReport[];
  slowestStages: Array<{ name: string; durationMs: number }>;
  timeouts: Array<{ stage: string; timeoutMs: number; elapsedMs: number }>;
  errors: Array<{ stage: string; error: string }>;
}

const DEFAULT_STAGE_TIMEOUT_MS = 180_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 900_000;
const DEFAULT_ASSET_CONCURRENCY = 4;
const DEFAULT_NETWORK_TIMEOUT_MS = 30_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseFlag(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveRocktomicBuildConfig(env: NodeJS.ProcessEnv): RocktomicBuildConfig {
  const modeRaw = (env.ROCKTOMIC_BUILD_AI_EXTRACTION_MODE || "").trim().toLowerCase();
  const forceRefresh = parseFlag(env.ROCKTOMIC_BUILD_FORCE_REFRESH);
  const skipAiExtraction = parseFlag(env.ROCKTOMIC_BUILD_SKIP_AI_EXTRACTION);

  let aiExtractionMode: RocktomicBuildConfig["aiExtractionMode"] = "incremental";
  if (modeRaw === "force") aiExtractionMode = "force";
  if (modeRaw === "skip") aiExtractionMode = "skip";
  if (forceRefresh) aiExtractionMode = "force";
  if (skipAiExtraction) aiExtractionMode = "skip";

  return {
    stageTimeoutMs: parsePositiveInt(env.ROCKTOMIC_BUILD_STAGE_TIMEOUT_MS, DEFAULT_STAGE_TIMEOUT_MS),
    totalTimeoutMs: parsePositiveInt(env.ROCKTOMIC_BUILD_TOTAL_TIMEOUT_MS, DEFAULT_TOTAL_TIMEOUT_MS),
    assetConcurrency: Math.min(10, Math.max(1, parsePositiveInt(env.ROCKTOMIC_BUILD_ASSET_CONCURRENCY, DEFAULT_ASSET_CONCURRENCY))),
    networkTimeoutMs: parsePositiveInt(env.ROCKTOMIC_BUILD_NETWORK_TIMEOUT_MS, DEFAULT_NETWORK_TIMEOUT_MS),
    aiExtractionMode,
    forceRefresh: aiExtractionMode === "force",
    skipAiExtraction: aiExtractionMode === "skip",
    dryRun: parseFlag(env.ROCKTOMIC_BUILD_DRY_RUN),
  };
}

export function createRocktomicBuildId(now = new Date()): string {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return iso;
}

export function sanitizeBuildError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export class RocktomicBuildTracer {
  private readonly stageReports: RocktomicBuildStageReport[] = [];
  private readonly timeouts: Array<{ stage: string; timeoutMs: number; elapsedMs: number }> = [];
  private readonly errors: Array<{ stage: string; error: string }> = [];
  private readonly startedAt = performance.now();

  constructor(private readonly config: RocktomicBuildConfig) {}

  async stage<T>(
    name: string,
    task: () => Promise<T>,
    options?: { timeoutMs?: number; recordsProcessed?: number; notes?: string[] }
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? this.config.stageTimeoutMs;
    const notes = [...(options?.notes || [])];
    const stageStart = performance.now();

    try {
      const value = await withTimeout(
        task(),
        timeoutMs,
        `stage_timeout:${name}: exceeded ${timeoutMs}ms. Consider reducing concurrency or enabling incremental cache mode.`
      );
      const durationMs = Math.round(performance.now() - stageStart);
      this.stageReports.push({
        name,
        status: "success",
        durationMs,
        recordsProcessed: options?.recordsProcessed,
        notes,
      });
      return value;
    } catch (error) {
      const durationMs = Math.round(performance.now() - stageStart);
      const errorMessage = sanitizeBuildError(error);
      if (/^stage_timeout:/.test(errorMessage)) {
        this.timeouts.push({ stage: name, timeoutMs, elapsedMs: durationMs });
      }
      this.errors.push({ stage: name, error: errorMessage });
      this.stageReports.push({
        name,
        status: "failed",
        durationMs,
        recordsProcessed: options?.recordsProcessed,
        notes,
        error: errorMessage,
      });
      throw error;
    }
  }

  skipStage(name: string, notes?: string[]): void {
    this.stageReports.push({
      name,
      status: "skipped",
      durationMs: 0,
      notes: notes || [],
    });
  }

  report(status: "success" | "failed", buildId: string): RocktomicBuildTimingReport {
    const totalDurationMs = Math.round(performance.now() - this.startedAt);
    const slowestStages = [...this.stageReports]
      .filter((entry) => entry.status !== "skipped")
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map((entry) => ({ name: entry.name, durationMs: entry.durationMs }));

    return {
      supplierSlug: "rocktomic",
      generatedAt: new Date().toISOString(),
      command: "ecomviper:build-rocktomic-supplier-data",
      status,
      buildId,
      totalDurationMs,
      stages: this.stageReports,
      slowestStages,
      timeouts: this.timeouts,
      errors: this.errors,
    };
  }
}

export async function writeArtifactsToDirectory(
  dir: string,
  artifacts: Record<string, string>
): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  for (const [fileName, payload] of Object.entries(artifacts)) {
    await fs.writeFile(path.join(dir, fileName), payload);
  }
}

export async function promoteBuildDirectoryToLatest(input: {
  packageDir: string;
  buildDir: string;
  buildId: string;
  artifactFileNames: string[];
}): Promise<void> {
  const latestDir = path.join(input.packageDir, "latest");
  const stagedDir = path.join(input.packageDir, `latest.__staged_${input.buildId}`);
  const backupDir = path.join(input.packageDir, `latest.__backup_${input.buildId}`);

  await fs.rm(stagedDir, { recursive: true, force: true });
  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.mkdir(stagedDir, { recursive: true });

  for (const fileName of input.artifactFileNames) {
    const from = path.join(input.buildDir, fileName);
    const to = path.join(stagedDir, fileName);
    await fs.copyFile(from, to);
  }

  const latestExists = await fs
    .stat(latestDir)
    .then((value) => value.isDirectory())
    .catch(() => false);

  try {
    if (latestExists) {
      await fs.rename(latestDir, backupDir);
    }
    await fs.rename(stagedDir, latestDir);
    if (latestExists) {
      await fs.rm(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    const stagedExists = await fs
      .stat(stagedDir)
      .then(() => true)
      .catch(() => false);
    const backupExists = await fs
      .stat(backupDir)
      .then(() => true)
      .catch(() => false);

    if (stagedExists) {
      await fs.rm(stagedDir, { recursive: true, force: true });
    }
    if (backupExists) {
      const latestRestored = await fs
        .stat(latestDir)
        .then(() => true)
        .catch(() => false);
      if (!latestRestored) {
        await fs.rename(backupDir, latestDir);
      }
    }
    throw error;
  }
}
