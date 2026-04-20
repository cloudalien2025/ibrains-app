import { createHash } from "node:crypto";
import {
  BuildSpec,
  ConnectionProfile,
  ExecutionResult,
  ThriveIntelligence,
  ThriveNativeCompositionPlan,
  ThriveNativeExecutionResult,
  ThriveNativeValidationResult,
  ThriveSectionResolution,
} from "@/lib/siteforge/contracts";
import { createThriveNativeCompositionPlan } from "@/lib/siteforge/thriveNativeComposer";
import {
  evaluateThriveNativeGuard,
  executeThriveNativePlan,
  rollbackThriveNativeExecution,
} from "@/lib/siteforge/thriveNativeHarness";
import { createId, nowIso } from "@/lib/siteforge/utils";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function authHeaders(connection: ConnectionProfile): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (connection.appPassword) {
    const token = Buffer.from(`${connection.username}:${connection.appPassword}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function endpointForObject(objectType: "thrive_template" | "thrive_section" | "tcb_symbol", id: number): string {
  if (objectType === "thrive_template") return `/wp-json/wp/v2/thrive_template/${id}`;
  if (objectType === "thrive_section") return `/wp-json/wp/v2/thrive_section/${id}`;
  return `/wp-json/wp/v2/tcb_symbol/${id}`;
}

function summarizeOutcomes(outcomes: ThriveNativeValidationResult["sectionOutcomes"]): ThriveNativeValidationResult["summary"] {
  return {
    reusedExisting: outcomes.filter((entry) => entry.outcome === "reused_existing").length,
    createdNative: outcomes.filter((entry) => entry.outcome === "created_native").length,
    wpFallback: outcomes.filter((entry) => entry.outcome === "wp_fallback").length,
    verificationFailed: outcomes.filter((entry) => entry.outcome === "verification_failed").length,
    blockedByGuard: outcomes.filter((entry) => entry.outcome === "blocked_by_guard").length,
    blockedByMissingContract: outcomes.filter((entry) => entry.outcome === "blocked_by_missing_contract").length,
  };
}

function operationMatchesSection(params: {
  plan: ThriveNativeCompositionPlan;
  sectionId: string;
  sectionOperation: NonNullable<ThriveNativeValidationResult["sectionOutcomes"][number]["operation"]>;
  operationIndex: number;
}): boolean {
  const op = params.plan.operations[params.operationIndex];
  if (!op || op.operation !== params.sectionOperation) return false;
  if (typeof op.payload.sectionId === "string") {
    return op.payload.sectionId === params.sectionId;
  }
  return true;
}

function attachExecutionResults(params: {
  plan: ThriveNativeCompositionPlan;
  execution: ThriveNativeExecutionResult;
  baseOutcomes: ThriveNativeValidationResult["sectionOutcomes"];
}): ThriveNativeValidationResult["sectionOutcomes"] {
  const usedStepIndexes = new Set<number>();
  return params.baseOutcomes.map((entry) => {
    if (!entry.operation) return entry;
    const stepIndex = params.execution.steps.findIndex((step, index) => {
      if (usedStepIndexes.has(index)) return false;
      if (step.operation !== entry.operation) return false;
      return operationMatchesSection({
        plan: params.plan,
        sectionId: entry.sectionId,
        sectionOperation: entry.operation,
        operationIndex: index,
      });
    });
    if (stepIndex < 0) return entry;
    usedStepIndexes.add(stepIndex);
    const step = params.execution.steps[stepIndex];
    if (!step) return entry;
    if (!step.success || !step.verificationPassed) {
      return {
        ...entry,
        outcome: "verification_failed",
        targetId: step.targetId,
        reason: step.detail || "verification_failed",
      };
    }
    return {
      ...entry,
      targetId: step.targetId,
    };
  });
}

async function verifyCreatedObjects(params: {
  connection: ConnectionProfile;
  execution: ThriveNativeExecutionResult | null;
}): Promise<{ ok: boolean; notes: string[] }> {
  if (!params.execution) return { ok: true, notes: [] };
  if (!params.execution.createdObjects.length) return { ok: true, notes: [] };

  const baseUrl = normalizeBaseUrl(params.connection.baseUrl);
  const headers = authHeaders(params.connection);
  const notes: string[] = [];
  let ok = true;

  for (const entry of params.execution.createdObjects) {
    const endpoint = endpointForObject(entry.objectType, entry.id);
    const res = await fetch(`${baseUrl}${endpoint}?context=edit`, { method: "GET", headers, cache: "no-store" });
    if (!res.ok) {
      ok = false;
      notes.push(`created_object_missing:${entry.objectType}:${entry.id}:${res.status}`);
      continue;
    }
    const record = await safeJson(res);
    if (typeof record?.id !== "number" || record.id !== entry.id) {
      ok = false;
      notes.push(`created_object_id_mismatch:${entry.objectType}:${entry.id}`);
    }
  }

  return { ok, notes };
}

async function verifyHomepageState(params: {
  connection: ConnectionProfile;
  homepagePostId: number | null;
}): Promise<{ pageReachable: boolean; pageIdentityOk: boolean; notes: string[] }> {
  const notes: string[] = [];
  if (!params.homepagePostId) {
    return { pageReachable: false, pageIdentityOk: false, notes: ["homepage_post_missing"] };
  }

  const baseUrl = normalizeBaseUrl(params.connection.baseUrl);
  const headers = authHeaders(params.connection);
  const pageRes = await fetch(`${baseUrl}/wp-json/wp/v2/pages/${params.homepagePostId}?context=edit`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!pageRes.ok) {
    return {
      pageReachable: false,
      pageIdentityOk: false,
      notes: [`homepage_page_lookup_failed:${pageRes.status}`],
    };
  }

  const page = await safeJson(pageRes);
  const identityOk = typeof page?.id === "number" && page.id === params.homepagePostId;
  if (!identityOk) notes.push("homepage_page_identity_mismatch");

  let pageReachable = false;
  const link = typeof page?.link === "string" && page.link.trim() ? page.link : null;
  if (!link) {
    notes.push("homepage_public_link_missing");
  } else {
    const renderRes = await fetch(link, { method: "GET", cache: "no-store" });
    pageReachable = renderRes.ok;
    if (!renderRes.ok) notes.push(`homepage_render_unreachable:${renderRes.status}`);
  }

  return {
    pageReachable,
    pageIdentityOk: identityOk,
    notes,
  };
}

async function verifyRollbackCleanup(params: {
  connection: ConnectionProfile;
  rollback: ThriveNativeExecutionResult["rollback"] | null;
}): Promise<{ success: boolean; notes: string[] }> {
  if (!params.rollback || !params.rollback.steps.length) {
    return { success: true, notes: [] };
  }

  const baseUrl = normalizeBaseUrl(params.connection.baseUrl);
  const headers = authHeaders(params.connection);
  let success = params.rollback.steps.every((entry) => entry.success);
  const notes: string[] = [];

  for (const entry of params.rollback.steps) {
    if (!entry.success) {
      notes.push(`rollback_step_failed:${entry.objectType}:${entry.id}:${entry.detail}`);
      continue;
    }
    const endpoint = endpointForObject(entry.objectType, entry.id);
    const res = await fetch(`${baseUrl}${endpoint}?context=edit`, { method: "GET", headers, cache: "no-store" });
    if (res.ok) {
      const record = await safeJson(res);
      const status = typeof record?.status === "string" ? record.status.toLowerCase() : "";
      if (status === "trash") {
        notes.push(`rollback_object_trashed:${entry.objectType}:${entry.id}`);
      } else {
        success = false;
        notes.push(`rollback_residual_object:${entry.objectType}:${entry.id}`);
      }
    }
  }

  return { success, notes };
}

function hashFingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 24);
}

export async function runThriveNativeValidation(params: {
  connection: ConnectionProfile;
  spec: BuildSpec;
  intelligence: ThriveIntelligence | null;
  sectionResolutions: ThriveSectionResolution[];
  execution: ExecutionResult;
  mode: "dry_run" | "real_run";
  rollbackStrategy?: "none" | "after_run";
}): Promise<ThriveNativeValidationResult> {
  const startedAt = nowIso();
  const runId = createId("sfnative");
  const guard = evaluateThriveNativeGuard(params.connection);
  const plan = createThriveNativeCompositionPlan({
    spec: params.spec,
    intelligence: params.intelligence,
    sectionResolutions: params.sectionResolutions,
    execution: params.execution,
    guard,
  });

  const baseOutcomes: ThriveNativeValidationResult["sectionOutcomes"] = plan.sections.map((entry) => ({
    pageSlug: entry.pageSlug,
    sectionId: entry.sectionId,
    sectionType: entry.sectionType,
    outcome: entry.intent,
    operation: entry.selectedOperation,
    targetId: null,
    reason: entry.reason,
  }));

  const completedAtBlocked = nowIso();
  if (!guard.eligible || plan.mode === "blocked_native_mode") {
    const blockedOutcomes = baseOutcomes.map((entry) => ({
      ...entry,
      outcome: "blocked_by_guard" as const,
    }));
    const summary = summarizeOutcomes(blockedOutcomes);
    return {
      runId,
      mode: params.mode,
      startedAt,
      completedAt: completedAtBlocked,
      status: "blocked",
      guard,
      planMode: plan.mode,
      homepagePostId: plan.homepagePostId,
      summary,
      sectionOutcomes: blockedOutcomes,
      verification: {
        stepsTotal: 0,
        verifiedSteps: 0,
        failedSteps: 0,
        pageReachable: false,
        pageIdentityOk: false,
        objectStateOk: false,
        notes: [`guard_blocked:${guard.blockedReason ?? "unknown"}`],
      },
      execution: null,
      rollback: null,
      rollbackVerification: {
        attempted: false,
        success: false,
        notes: [],
      },
      promotionCandidateSummary: {
        ready: false,
        reason: `blocked:${guard.blockedReason ?? "unknown"}`,
        environment: guard.environment,
        runFingerprint: hashFingerprint({ runId, mode: params.mode, blocked: guard.blockedReason }),
        pageId: plan.homepagePostId,
        shellTemplateId: null,
        reusedSymbolIds: [],
        createdObjectIds: [],
        payloadHashes: plan.operations.map((entry) => entry.payloadHash),
        verificationSnapshot: {
          stepsTotal: 0,
          verifiedSteps: 0,
          failedSteps: 0,
          objectStateOk: false,
          pageReachable: false,
          pageIdentityOk: false,
        },
        rollbackSnapshot: {
          available: false,
          attempted: false,
          success: false,
        },
        themeArtifactRef: params.spec.metadata.themeArtifactRef ?? null,
        architectContentArtifactRef: params.spec.metadata.architectContentArtifactRef ?? null,
        landingPageArtifactRef: params.spec.metadata.landingPageArtifactRef ?? null,
        designPackArtifactRef: params.spec.metadata.designPackArtifactRef ?? null,
        contractCaptureRef: params.spec.metadata.contractCaptureRef ?? null,
      },
    };
  }

  if (params.mode === "dry_run") {
    const homepageCheck = await verifyHomepageState({
      connection: params.connection,
      homepagePostId: plan.homepagePostId,
    });
    const drySummary = summarizeOutcomes(baseOutcomes);
    const completedAtDry = nowIso();
    const verificationNotes = [...homepageCheck.notes];
    const status =
      drySummary.blockedByGuard > 0 || drySummary.blockedByMissingContract > 0
        ? "failed"
        : homepageCheck.pageIdentityOk
          ? "passed"
          : "failed";
    return {
      runId,
      mode: "dry_run",
      startedAt,
      completedAt: completedAtDry,
      status,
      guard,
      planMode: plan.mode,
      homepagePostId: plan.homepagePostId,
      summary: drySummary,
      sectionOutcomes: baseOutcomes,
      verification: {
        stepsTotal: plan.operations.length,
        verifiedSteps: 0,
        failedSteps: 0,
        pageReachable: homepageCheck.pageReachable,
        pageIdentityOk: homepageCheck.pageIdentityOk,
        objectStateOk: true,
        notes: verificationNotes,
      },
      execution: null,
      rollback: null,
      rollbackVerification: {
        attempted: false,
        success: true,
        notes: [],
      },
      promotionCandidateSummary: {
        ready: false,
        reason: "dry_run_only",
        environment: guard.environment,
        runFingerprint: hashFingerprint({
          runId,
          mode: "dry_run",
          planHashes: plan.operations.map((entry) => entry.payloadHash),
        }),
        pageId: plan.homepagePostId,
        shellTemplateId: null,
        reusedSymbolIds: baseOutcomes
          .filter((entry) => entry.outcome === "reused_existing" && typeof entry.targetId === "number")
          .map((entry) => entry.targetId as number),
        createdObjectIds: [],
        payloadHashes: plan.operations.map((entry) => entry.payloadHash),
        verificationSnapshot: {
          stepsTotal: plan.operations.length,
          verifiedSteps: 0,
          failedSteps: 0,
          objectStateOk: true,
          pageReachable: homepageCheck.pageReachable,
          pageIdentityOk: homepageCheck.pageIdentityOk,
        },
        rollbackSnapshot: {
          available: false,
          attempted: false,
          success: true,
        },
        themeArtifactRef: params.spec.metadata.themeArtifactRef ?? null,
        architectContentArtifactRef: params.spec.metadata.architectContentArtifactRef ?? null,
        landingPageArtifactRef: params.spec.metadata.landingPageArtifactRef ?? null,
        designPackArtifactRef: params.spec.metadata.designPackArtifactRef ?? null,
        contractCaptureRef: params.spec.metadata.contractCaptureRef ?? null,
      },
    };
  }

  const nativeExecution = await executeThriveNativePlan({
    connection: params.connection,
    mode: plan.mode,
    operations: plan.operations.map((entry) => ({
      operation: entry.operation,
      payload: entry.payload,
    })),
  });

  const sectionOutcomes = attachExecutionResults({
    plan,
    execution: nativeExecution,
    baseOutcomes,
  });

  const createdObjectsCheck = await verifyCreatedObjects({
    connection: params.connection,
    execution: nativeExecution,
  });
  const homepageCheck = await verifyHomepageState({
    connection: params.connection,
    homepagePostId: plan.homepagePostId,
  });

  let rollback: ThriveNativeExecutionResult["rollback"] | null = null;
  let rollbackVerification = {
    attempted: false,
    success: true,
    notes: [] as string[],
  };
  if ((params.rollbackStrategy ?? "none") === "after_run" && nativeExecution.rollback.available) {
    rollback = await rollbackThriveNativeExecution({
      connection: params.connection,
      execution: nativeExecution,
    });
    const rollbackCheck = await verifyRollbackCleanup({
      connection: params.connection,
      rollback,
    });
    rollbackVerification = {
      attempted: true,
      success: rollbackCheck.success,
      notes: rollbackCheck.notes,
    };
  }

  const verificationNotes = [
    ...createdObjectsCheck.notes,
    ...homepageCheck.notes,
    ...rollbackVerification.notes,
    ...nativeExecution.warnings,
  ];

  const summary = summarizeOutcomes(sectionOutcomes);
  const verifiedSteps = nativeExecution.steps.filter((step) => step.success && step.verificationPassed).length;
  const failedSteps = nativeExecution.steps.length - verifiedSteps;
  const objectStateOk = createdObjectsCheck.ok;
  const status =
    nativeExecution.success &&
    objectStateOk &&
    homepageCheck.pageIdentityOk &&
    (rollbackVerification.attempted ? rollbackVerification.success : true)
      ? "passed"
      : "failed";

  const shellTemplateId =
    nativeExecution.steps.find((entry) => entry.objectType === "thrive_template" && entry.success && entry.verificationPassed)
      ?.targetId ?? null;

  const completedAt = nowIso();
  return {
    runId,
    mode: "real_run",
    startedAt,
    completedAt,
    status,
    guard,
    planMode: plan.mode,
    homepagePostId: plan.homepagePostId,
    summary,
    sectionOutcomes,
    verification: {
      stepsTotal: nativeExecution.steps.length,
      verifiedSteps,
      failedSteps,
      pageReachable: homepageCheck.pageReachable,
      pageIdentityOk: homepageCheck.pageIdentityOk,
      objectStateOk,
      notes: verificationNotes,
    },
    execution: nativeExecution,
    rollback,
    rollbackVerification,
    promotionCandidateSummary: {
      ready: status === "passed",
      reason: status === "passed" ? "validation_passed" : "validation_failed",
      environment: guard.environment,
      runFingerprint: hashFingerprint({
        runId,
        mode: "real_run",
        payloadHashes: plan.operations.map((entry) => entry.payloadHash),
        createdObjects: nativeExecution.createdObjects,
        verification: {
          steps: nativeExecution.steps.map((entry) => ({
            op: entry.operation,
            ok: entry.success && entry.verificationPassed,
          })),
          page: { reachable: homepageCheck.pageReachable, identity: homepageCheck.pageIdentityOk },
          rollback: rollbackVerification,
        },
      }),
      pageId: plan.homepagePostId,
      shellTemplateId,
      reusedSymbolIds: sectionOutcomes
        .filter((entry) => entry.outcome === "reused_existing" && typeof entry.targetId === "number")
        .map((entry) => entry.targetId as number),
      createdObjectIds: nativeExecution.createdObjects.map((entry) => ({
        objectType: entry.objectType,
        id: entry.id,
      })),
      payloadHashes: plan.operations.map((entry) => entry.payloadHash),
      verificationSnapshot: {
        stepsTotal: nativeExecution.steps.length,
        verifiedSteps,
        failedSteps,
        objectStateOk,
        pageReachable: homepageCheck.pageReachable,
        pageIdentityOk: homepageCheck.pageIdentityOk,
      },
      rollbackSnapshot: {
        available: nativeExecution.rollback.available,
        attempted: rollbackVerification.attempted,
        success: rollbackVerification.success,
      },
      themeArtifactRef: params.spec.metadata.themeArtifactRef ?? null,
      architectContentArtifactRef: params.spec.metadata.architectContentArtifactRef ?? null,
      landingPageArtifactRef: params.spec.metadata.landingPageArtifactRef ?? null,
      designPackArtifactRef: params.spec.metadata.designPackArtifactRef ?? null,
      contractCaptureRef: params.spec.metadata.contractCaptureRef ?? null,
    },
  };
}
