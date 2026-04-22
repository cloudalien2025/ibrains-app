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
import { runMarketIntelligenceAgent } from "@/lib/siteforge/agents/marketIntelligence";
import { applyThriveMappings, detectThriveCapability } from "@/lib/siteforge/thrive";
import { discoverThriveIntelligence } from "@/lib/siteforge/thriveIntelligence";
import { synthesizeWebsiteStrategy } from "@/lib/siteforge/websiteStrategy";
import {
  evaluateThriveNativeGuard,
  getThriveExecutionRuntime,
} from "@/lib/siteforge/thriveNativeHarness";
import { createThriveNativeCompositionPlan } from "@/lib/siteforge/thriveNativeComposer";
import { runThriveNativeValidation } from "@/lib/siteforge/thriveNativeValidation";
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
  planning: 12,
  writing: 32,
  building: 52,
  executing: 72,
  reviewing: 88,
  finalizing: 95,
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
  serpApiKey: string | null;
  aiModel: string;
  generationSource: "user_key" | "platform_key" | "deterministic_fallback";
  connection: ConnectionProfile | null;
  homepageStrategy?: HomepageStrategyMode;
  connectionId?: string | null;
}): Promise<void> {
  const { repo, sessionId, connection } = params;

  try {
    const marketIntelligence = await runMarketIntelligenceAgent({
      brief: params.websiteBrief,
      serpApiKey: params.serpApiKey,
    });
    await repo.updateSession(sessionId, { marketIntelligence });
    await updateStage(
      repo,
      sessionId,
      "planning",
      `Market intelligence: ${marketIntelligence.status} (${marketIntelligence.source})`
    );

    await updateStage(repo, sessionId, "planning", "Planning your site structure");
    const websiteStrategy = synthesizeWebsiteStrategy({
      brief: params.websiteBrief,
      marketIntelligence,
      thriveIntelligence: null,
    });
    await repo.updateSession(sessionId, { websiteStrategy });
    await updateStage(repo, sessionId, "planning", `Strategy synthesized: ${websiteStrategy.siteType} · ${websiteStrategy.primaryConversionGoal}`);
    const sitePlan = await runPlannerAgent({
      brief: params.websiteBrief,
      model: params.aiModel,
      apiKey: params.apiKey,
      marketIntelligence,
      websiteStrategy,
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
      marketIntelligence,
    });
    await repo.updateSession(sessionId, { contentPackage });

    await updateStage(repo, sessionId, "building", "Designing your layout");
    const buildSpec = runBuildSpecAgent(sitePlan, contentPackage, {
      websiteStrategy,
      marketIntelligence,
      thriveIntelligence: null,
    });
    await repo.updateSession(sessionId, { buildSpec });
    await updateStage(repo, sessionId, "building", "Building technical page specification");

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
        const thriveIntelligence = thriveEnabled ? await discoverThriveIntelligence(connection) : null;
        const runtime = getThriveExecutionRuntime({
          thriveIntelligenceAvailable: Boolean(thriveIntelligence),
        });
        const strategyWithThrive = synthesizeWebsiteStrategy({
          brief: params.websiteBrief,
          marketIntelligence,
          thriveIntelligence,
        });
        const buildSpecWithThrive = runBuildSpecAgent(sitePlan, contentPackage, {
          websiteStrategy: strategyWithThrive,
          marketIntelligence,
          thriveIntelligence,
        });
        const translated = applyThriveMappings(buildSpecWithThrive, thriveEnabled, thriveIntelligence);
        const prefersThriveNative = thriveEnabled && runtime.stagingNativeMode;
        await updateStage(
          repo,
          sessionId,
          "executing",
          prefersThriveNative
            ? "Executing Build in Thrive (native-first with fallback protection)"
            : "Executing standard WordPress build"
        );
        const execution = await executeBuildSpecToWordPress(connection, translated.spec, {
          enabled: thriveEnabled,
          appliedMappings: translated.appliedMappings,
          fallbackUsed: translated.fallbackUsed,
          executionMode: prefersThriveNative ? "future_thrive_native_mode" : "wp_safe_mode",
          buildModeUsed: thriveEnabled ? "thrive_fallback" : "wordpress_fallback",
          buildModeReason: thriveEnabled ? "thrive_detected_native_pending" : "thrive_not_detected",
          intelligenceAvailable: Boolean(thriveIntelligence),
          symbolInventoryPresent: Boolean((thriveIntelligence?.symbolInventory.length ?? 0) > 0),
          intelligence: thriveIntelligence,
          runtime,
          currentMode: runtime.thriveIntelMode ? "thrive_intel_mode" : "wp_safe_mode",
          nativeGuard: null,
          nativeComposition: null,
          nativeExecution: null,
          nativeValidation: null,
          sectionResolutions: translated.sectionResolutions,
        }, params.homepageStrategy ?? "use_existing");

        const nativeGuard = evaluateThriveNativeGuard(connection);
        let nativeComposition = null;
        let nativeExecution = null;
        let nativeValidation = null;
        let buildModeUsed: "thrive_native" | "thrive_fallback" | "wordpress_fallback" = thriveEnabled
          ? "thrive_fallback"
          : "wordpress_fallback";
        let buildModeReason: string | null = thriveEnabled ? "thrive_detected_native_pending" : "thrive_not_detected";
        let currentMode: "wp_safe_mode" | "thrive_intel_mode" | "thrive_native_staging_mode" | "blocked_native_mode" =
          runtime.thriveIntelMode ? "thrive_intel_mode" : "wp_safe_mode";

        if (runtime.stagingNativeMode) {
          nativeComposition = createThriveNativeCompositionPlan({
            spec: translated.spec,
            intelligence: thriveIntelligence,
            sectionResolutions: translated.sectionResolutions,
            execution,
            guard: nativeGuard,
          });
          if (nativeGuard.eligible) {
            const validationMode = process.env.SITEFORGE_THRIVE_NATIVE_VALIDATION_MODE === "dry_run" ? "dry_run" : "real_run";
            const rollbackStrategy =
              process.env.SITEFORGE_THRIVE_NATIVE_VALIDATION_ROLLBACK === "1" ? "after_run" : "none";
            nativeValidation = await runThriveNativeValidation({
              connection,
              spec: translated.spec,
              intelligence: thriveIntelligence,
              sectionResolutions: translated.sectionResolutions,
              execution,
              mode: validationMode,
              rollbackStrategy,
            });
            nativeExecution = nativeValidation.execution;
            if (nativeValidation.status === "passed") {
              currentMode = "thrive_native_staging_mode";
              buildModeUsed = "thrive_native";
              buildModeReason = "native_validation_passed";
            } else {
              currentMode = "blocked_native_mode";
              buildModeUsed = "thrive_fallback";
              buildModeReason = `native_validation_${nativeValidation.status}`;
            }
            translated.spec.metadata.contractCaptureRef =
              translated.spec.metadata.contractCaptureRef ??
              `contract:${nativeGuard.schemaContractVersion ?? "unknown"}:${nowIso()}`;
          } else {
            currentMode = "blocked_native_mode";
            buildModeUsed = thriveEnabled ? "thrive_fallback" : "wordpress_fallback";
            buildModeReason = `native_guard_blocked:${nativeGuard.blockedReason ?? "unknown"}`;
          }
        } else if (thriveEnabled) {
          buildModeUsed = "thrive_fallback";
          buildModeReason = "native_runtime_unavailable";
        }

        execution.thrive.currentMode = currentMode;
        execution.thrive.nativeGuard = nativeGuard;
        execution.thrive.nativeComposition = nativeComposition;
        execution.thrive.nativeExecution = nativeExecution;
        execution.thrive.nativeValidation = nativeValidation;
        execution.thrive.buildModeUsed = buildModeUsed;
        execution.thrive.buildModeReason = buildModeReason;
        if (buildModeUsed !== "thrive_native") {
          execution.warnings.push(
            buildModeUsed === "thrive_fallback"
              ? "Thrive-native build path was unavailable; fallback path was used."
              : "Thrive was not detected; standard WordPress fallback path was used."
          );
        }
        executionResult = execution;
        await repo.updateSession(sessionId, {
          buildSpec: translated.spec,
          executionResult,
        });
      }
    }

    await updateStage(repo, sessionId, "reviewing", "Verifying your draft");
    await updateStage(repo, sessionId, "finalizing", "Finalizing build package");

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
