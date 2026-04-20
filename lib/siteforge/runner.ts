import { ConnectionProfile, HomepageStrategyMode, WebsiteBrief } from "@/lib/siteforge/contracts";
import { runBuildPipeline, runRevisionPipeline } from "@/lib/siteforge/orchestrator";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";

declare global {
  var __siteforge_running_jobs__: Set<string> | undefined;
}

function runningJobs(): Set<string> {
  if (!globalThis.__siteforge_running_jobs__) {
    globalThis.__siteforge_running_jobs__ = new Set();
  }
  return globalThis.__siteforge_running_jobs__;
}

export async function enqueueBuildJob(params: {
  sessionId: string;
  prompt: string;
  websiteBrief: WebsiteBrief;
  apiKey: string;
  serpApiKey: string | null;
  aiModel: string;
  generationSource: "user_key" | "platform_key" | "deterministic_fallback";
  connection: ConnectionProfile | null;
  connectionId?: string | null;
  homepageStrategy?: HomepageStrategyMode;
}): Promise<void> {
  const jobs = runningJobs();
  if (jobs.has(params.sessionId)) return;

  jobs.add(params.sessionId);

  queueMicrotask(async () => {
    try {
      const repo = await getSiteForgeRepository();
      await runBuildPipeline({
        repo,
        sessionId: params.sessionId,
        prompt: params.prompt,
        websiteBrief: params.websiteBrief,
        apiKey: params.apiKey,
        serpApiKey: params.serpApiKey,
        aiModel: params.aiModel,
        generationSource: params.generationSource,
        connection: params.connection,
        connectionId: params.connectionId,
        homepageStrategy: params.homepageStrategy,
      });
    } finally {
      jobs.delete(params.sessionId);
    }
  });
}

export async function enqueueRevisionJob(params: {
  sessionId: string;
  message: string;
  connection: ConnectionProfile | null;
  connectionId?: string | null;
  homepageStrategy?: HomepageStrategyMode;
}): Promise<void> {
  const jobs = runningJobs();
  const key = `${params.sessionId}:revision`;
  if (jobs.has(key)) return;

  jobs.add(key);

  queueMicrotask(async () => {
    try {
      const repo = await getSiteForgeRepository();
      await runRevisionPipeline({
        repo,
        sessionId: params.sessionId,
        message: params.message,
        connection: params.connection,
        connectionId: params.connectionId,
        homepageStrategy: params.homepageStrategy,
      });
    } finally {
      jobs.delete(key);
    }
  });
}
