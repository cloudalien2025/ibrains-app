import {
  BuildSession,
  BuildStage,
  CapabilityCheckResult,
  ConnectionProfile,
  HomepageStrategyMode,
  OrchestratorOutput,
  RetryDirective,
  WebsiteBrief,
} from "@/lib/siteforge/contracts";
import { runPlannerAgent } from "@/lib/siteforge/agents/planner";
import { runContentAgent } from "@/lib/siteforge/agents/content";
import { runBuildSpecAgent } from "@/lib/siteforge/agents/buildSpec";
import { runQaAgent } from "@/lib/siteforge/agents/qa";
import { applyThriveMappings, detectThriveCapability } from "@/lib/siteforge/thrive";
import {
  executeBuildSpecToWordPress,
  executeRevisionToWordPress,
  validateWordPressConnection,
} from "@/lib/siteforge/wordpress/service";
import {
  applyBuildDelta,
  createBuildDelta,
  runRevisionQa,
  toRevisionExecutionResult,
} from "@/lib/siteforge/refinement";
import { SiteForgeRepository } from "@/lib/siteforge/repository/types";
import { clampProgress, createId, nowIso } from "@/lib/siteforge/utils";
import { persistSnapshotFromSession } from "@/lib/siteforge/workspace";

const stageProgress: Record<BuildStage, number> = {
  planning: 15,
  writing: 35,
  building: 55,
  reviewing: 72,
  finalizing: 84,
  executing: 96,
  completed: 100,
  failed: 100,
};

function classifyRetry(error: unknown): RetryDirective {
  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (/timeout|econnreset|network|temporarily unavailable/.test(text)) {
    return {
      retryable: true,
      reason: "Transient network/platform failure",
    };
  }

  return {
    retryable: false,
    reason: "Non-retryable validation or execution failure",
  };
}

async function updateStage(
  repo: SiteForgeRepository,
  sessionId: string,
  stage: BuildStage,
  message: string,
  level: "info" | "warning" | "error" = "info"
): Promise<void> {
  const session = await repo.getSession(sessionId);
  if (!session) return;
  const timestamp = nowIso();

  await repo.updateSession(sessionId, {
    runState: {
      currentStage: stage,
      progressPct: clampProgress(stageProgress[stage]),
      timeline: [
        ...session.runState.timeline,
        {
          at: timestamp,
          stage,
          message,
          level,
        },
      ],
    },
    updatedAt: timestamp,
  });
  await repo.appendRunLog({
    logId: createId("sflog"),
    sessionId,
    stage,
    message,
    level,
    timestamp,
  });
}

export async function runBuildPipeline(params: {
  repo: SiteForgeRepository;
  sessionId: string;
  prompt: string;
  websiteBrief: WebsiteBrief;
  apiKey: string;
  aiModel: string;
  generationSource: "user_key" | "platform_key" | "deterministic_fallback";
  connection: ConnectionProfile | null;
  homepageStrategy?: HomepageStrategyMode;
  connectionId?: string | null;
}): Promise<void> {
  const { repo, sessionId, connection } = params;

  try {
    await updateStage(repo, sessionId, "planning", "Planning your site structure");
    const sitePlan = await runPlannerAgent({
      brief: params.websiteBrief,
      model: params.aiModel,
      apiKey: params.apiKey,
    });
    await repo.updateSession(sessionId, { sitePlan, status: "running" });
    await updateStage(
      repo,
      sessionId,
      "planning",
      `Generation source: ${params.generationSource === "user_key" ? "user-provided key" : "platform key"} · model: ${params.aiModel}`
    );

    await updateStage(repo, sessionId, "writing", "Writing conversion-focused page content");
    const contentPackage = await runContentAgent({
      sitePlan,
      brief: params.websiteBrief,
      model: params.aiModel,
      apiKey: params.apiKey,
    });
    await repo.updateSession(sessionId, { contentPackage });

    await updateStage(repo, sessionId, "building", "Building technical page specification");
    const buildSpec = runBuildSpecAgent(sitePlan, contentPackage);
    await repo.updateSession(sessionId, { buildSpec });

    await updateStage(repo, sessionId, "reviewing", "Running quality checks");
    const qaResult = runQaAgent(buildSpec);
    await repo.updateSession(sessionId, { qaResult });

    if (!qaResult.isValid) {
      await repo.updateSession(sessionId, {
        status: "failed",
        errorSummary: "Build failed QA validation.",
        completedAt: nowIso(),
        finishedAt: nowIso(),
      });
      await updateStage(repo, sessionId, "failed", "Build failed QA validation.", "error");
      return;
    }

    let executionResult: OrchestratorOutput["executionResult"] = null;

    await updateStage(repo, sessionId, "finalizing", "Finalizing build package");

    if (connection?.baseUrl && connection.username && connection.appPassword) {
      await updateStage(repo, sessionId, "executing", "Executing site build in WordPress");
      const capability: CapabilityCheckResult = await validateWordPressConnection(connection);

      if (!capability.connected || !capability.canWritePages) {
        await updateStage(
          repo,
          sessionId,
          "executing",
          `Connection validation warning: ${capability.message}`,
          "warning"
        );
      } else {
        const thriveEnabled = detectThriveCapability(capability);
        const translated = applyThriveMappings(buildSpec, thriveEnabled);
        const execution = await executeBuildSpecToWordPress(connection, translated.spec, {
          enabled: thriveEnabled,
          appliedMappings: translated.appliedMappings,
          fallbackUsed: translated.fallbackUsed,
        });
        executionResult = execution;
        await repo.updateSession(sessionId, {
          buildSpec: translated.spec,
          executionResult,
        });
      }
    }

    await repo.updateSession(sessionId, {
      status: "completed",
      completedAt: nowIso(),
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    });
    await updateStage(repo, sessionId, "completed", "Build run completed");

    const latest = await repo.getSession(sessionId);
    if (latest) {
      const project = await repo.getProject(latest.projectId, latest.userId);
      await persistSnapshotFromSession({
        repo,
        session: latest,
        homepageStrategy: params.homepageStrategy ?? project?.homepageStrategy ?? "use_existing",
        connectionId: params.connectionId ?? latest.connectionId,
        thriveDetected: Boolean(latest.executionResult?.thrive.enabled || connection?.hasThriveHint),
      });
    }
  } catch (error: unknown) {
    const retry = classifyRetry(error);
    await updateStage(
      repo,
      sessionId,
      "failed",
      `Build failed: ${error instanceof Error ? error.message : "unknown error"}`,
      "error"
    );
    await repo.updateSession(sessionId, {
      status: "failed",
      errorSummary: error instanceof Error ? error.message : "Unknown error",
      completedAt: nowIso(),
      finishedAt: nowIso(),
    });
    await repo.appendFailure(sessionId, {
      id: createId("fail"),
      at: nowIso(),
      message: error instanceof Error ? error.message : "Unknown error",
      retryable: retry.retryable,
      reason: retry.reason,
    });
  }
}

export async function runRevisionPipeline(params: {
  repo: SiteForgeRepository;
  sessionId: string;
  message: string;
  connection: ConnectionProfile | null;
  homepageStrategy?: HomepageStrategyMode;
  connectionId?: string | null;
}): Promise<void> {
  const { repo, sessionId, message, connection } = params;
  const session = await repo.getSession(sessionId);
  if (!session?.buildSpec) return;

  try {
    await updateStage(repo, sessionId, "planning", "Planning requested refinement");
    const request = { message };
    const delta = createBuildDelta(request);

    await updateStage(repo, sessionId, "building", "Applying targeted changes");
    const revisedSpec = applyBuildDelta(session.buildSpec, delta);

    await updateStage(repo, sessionId, "reviewing", "Validating revised spec");
    const qa = runRevisionQa(revisedSpec);

    if (!qa.isValid) {
      await repo.updateSession(sessionId, {
        errorSummary: "Revision QA failed.",
      });
      await updateStage(repo, sessionId, "failed", "Revision QA failed", "error");
      return;
    }

    let revisionExecution = toRevisionExecutionResult({
      success: true,
      updatedPages: [],
      warnings: [],
      errors: [],
    });

    if (connection?.baseUrl && connection.username && connection.appPassword && session.executionResult) {
      await updateStage(repo, sessionId, "executing", "Applying changes to WordPress");
      const execution = await executeRevisionToWordPress(connection, revisedSpec, session.executionResult);
      revisionExecution = toRevisionExecutionResult(execution);
    }

    await repo.addRevision(sessionId, {
      id: createId("rev"),
      at: nowIso(),
      request,
      delta,
      qa,
      execution: revisionExecution,
    });

    await repo.updateSession(sessionId, {
      type: "refine",
      buildSpec: revisedSpec,
      updatedAt: nowIso(),
    });

    await updateStage(repo, sessionId, "completed", "Revision completed");

    const latest = await repo.getSession(sessionId);
    if (latest) {
      const project = await repo.getProject(latest.projectId, latest.userId);
      await persistSnapshotFromSession({
        repo,
        session: latest,
        homepageStrategy: params.homepageStrategy ?? project?.homepageStrategy ?? "use_existing",
        connectionId: params.connectionId ?? latest.connectionId,
        thriveDetected: Boolean(latest.executionResult?.thrive.enabled || connection?.hasThriveHint),
      });
    }
  } catch (error: unknown) {
    await updateStage(
      repo,
      sessionId,
      "failed",
      `Revision failed: ${error instanceof Error ? error.message : "unknown"}`,
      "error"
    );
    await repo.updateSession(sessionId, {
      errorSummary: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function createInitialRunState(): BuildSession["runState"] {
  return {
    currentStage: "planning",
    progressPct: 0,
    timeline: [
      {
        at: nowIso(),
        stage: "planning",
        message: "Build queued",
        level: "info",
      },
    ],
  };
}
