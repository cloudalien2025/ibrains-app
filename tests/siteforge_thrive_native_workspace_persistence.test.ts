import { describe, expect, it, vi } from "vitest";
import { BuildSession, SiteForgeSnapshot } from "@/lib/siteforge/contracts";
import { persistSnapshotFromSession } from "@/lib/siteforge/workspace";

function sessionWithNative(): BuildSession {
  const now = "2026-04-20T00:00:00.000Z";
  return {
    id: "sess_1",
    projectId: "proj_1",
    userId: "user_1",
    connectionId: "conn_1",
    type: "generate",
    triggerSource: "user",
    prompt: "build",
    websiteBrief: null,
    generationSource: "deterministic_fallback",
    aiModel: "gpt-5",
    connectionProfile: null,
    status: "completed",
    runState: { currentStage: "completed", progressPct: 100, timeline: [] },
    sitePlan: null,
    contentPackage: null,
    buildSpec: {
      siteTitle: "Acme",
      homepageSlug: "home",
      menu: [{ label: "Home", slug: "home" }],
      pages: [{ pageId: "p1", title: "Home", slug: "home", purpose: "home", sections: [], metadata: { template: "landing" } }],
      metadata: { conversionFocus: "high", thriveAware: true, createdAt: now },
    },
    qaResult: null,
    executionResult: {
      success: true,
      createdPages: [{ title: "Home", slug: "home", pageId: 65, url: "https://example.com/home", status: "updated", intent: "homepage", decision: "reused_existing" }],
      homepage: { success: true, pageId: 65, title: "Home", message: "ok" },
      menu: { success: true, menuId: 10, message: "ok" },
      thrive: {
        enabled: true,
        appliedMappings: [],
        fallbackUsed: false,
        executionMode: "wp_safe_mode",
        intelligenceAvailable: true,
        symbolInventoryPresent: true,
        intelligence: null,
        runtime: { wpSafeMode: true, thriveIntelMode: true, stagingNativeMode: true },
        currentMode: "thrive_native_staging_mode",
        nativeGuard: {
          eligible: true,
          blockedReason: null,
          environment: "test",
          nativeTargetMode: "approved_non_production_target",
          targetClassification: "approved_non_production_target",
          nativeTargetEligibility: "eligible",
          approvedTargetHost: "staging.example.com",
          approvalSource: "env_allowlist",
          connectionHost: "staging.example.com",
          allowlistedOperations: ["createOrUpdateSection"],
          routeAllowlist: ["/wp-json/wp/v2/thrive_section"],
          schemaContractVersion: "v1",
        },
        nativeComposition: {
          mode: "thrive_native_staging_mode",
          homepagePostId: 65,
          shellTemplateGroupCandidate: "homepage",
          shellLayoutCandidate: "thrive-homepage-canonical",
          operations: [],
          sections: [],
          summary: { reusedExisting: 1, createdNative: 1, wpFallback: 0, blockedByGuard: 0, blockedByMissingContract: 0 },
        },
        nativeExecution: {
          executedAt: now,
          success: true,
          mode: "thrive_native_staging_mode",
          steps: [],
          createdObjects: [],
          rollback: { available: false, steps: [] },
          warnings: [],
        },
        nativeValidation: {
          runId: "sfnative_1",
          mode: "real_run",
          startedAt: now,
          completedAt: now,
          status: "passed",
          guard: {
            eligible: true,
            blockedReason: null,
            environment: "test",
            nativeTargetMode: "approved_non_production_target",
            targetClassification: "approved_non_production_target",
            nativeTargetEligibility: "eligible",
            approvedTargetHost: "staging.example.com",
            approvalSource: "env_allowlist",
            connectionHost: "staging.example.com",
            allowlistedOperations: ["createOrUpdateSection"],
            routeAllowlist: ["/wp-json/wp/v2/thrive_section"],
            schemaContractVersion: "v1",
          },
          planMode: "thrive_native_staging_mode",
          homepagePostId: 65,
          summary: {
            reusedExisting: 1,
            createdNative: 1,
            wpFallback: 0,
            verificationFailed: 0,
            blockedByGuard: 0,
            blockedByMissingContract: 0,
          },
          sectionOutcomes: [],
          verification: {
            stepsTotal: 1,
            verifiedSteps: 1,
            failedSteps: 0,
            pageReachable: true,
            pageIdentityOk: true,
            objectStateOk: true,
            notes: [],
          },
          execution: null,
          rollback: null,
          rollbackVerification: {
            attempted: false,
            success: true,
            notes: [],
          },
          promotionCandidateSummary: {
            ready: true,
            reason: "validation_passed",
            environment: "test",
            runFingerprint: "abc123",
            pageId: 65,
            shellTemplateId: 10,
            reusedSymbolIds: [],
            createdObjectIds: [],
            payloadHashes: ["hash1"],
            verificationSnapshot: {
              stepsTotal: 1,
              verifiedSteps: 1,
              failedSteps: 0,
              objectStateOk: true,
              pageReachable: true,
              pageIdentityOk: true,
            },
            rollbackSnapshot: {
              available: false,
              attempted: false,
              success: true,
            },
            themeArtifactRef: null,
            architectContentArtifactRef: null,
            landingPageArtifactRef: null,
            designPackArtifactRef: null,
            contractCaptureRef: "contract:v1",
          },
        },
        sectionResolutions: [],
      },
      actionLog: [],
      warnings: [],
      errors: [],
    },
    revisionHistory: [],
    errorSummary: null,
    startedAt: now,
    completedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("siteforge thrive native workspace persistence", () => {
  it("persists native staging guard/composition/execution metadata into snapshot", async () => {
    const repo = {
      upsertSnapshot: vi.fn(async (snapshot: SiteForgeSnapshot) => snapshot),
    };

    const snapshot = await persistSnapshotFromSession({
      repo: repo as never,
      session: sessionWithNative(),
      homepageStrategy: "use_existing",
      connectionId: "conn_1",
      thriveDetected: true,
    });

    expect(snapshot.thriveModeSummary.stagingNativeMode).toBe(true);
    expect(snapshot.thriveNativeGuard?.eligible).toBe(true);
    expect(snapshot.thriveNativeComposition?.mode).toBe("thrive_native_staging_mode");
    expect(snapshot.thriveNativeExecution?.success).toBe(true);
    expect(snapshot.thriveNativeValidation?.status).toBe("passed");
    expect(snapshot.thriveNativeValidation?.promotionCandidateSummary.ready).toBe(true);
  });
});
