import { describe, expect, it } from "vitest";
import { getLaunchProgressState } from "@/app/pagebolt/page";

describe("siteforge launch progress state", () => {
  it("shows all required human-readable stages", () => {
    const state = getLaunchProgressState({
      currentSession: null,
      hasCompletedBuild: false,
      hasSerpApiKey: true,
      isThriveDetected: true,
    });

    expect(state.stages.map((stage) => stage.label)).toEqual([
      "Preparing your build",
      "Researching your market",
      "Planning your pages",
      "Writing your content",
      "Designing your layout",
      "Building in Thrive",
      "Verifying your draft",
      "Draft ready",
    ]);
  });

  it("uses truthful fallback research copy when SerpAPI is unavailable", () => {
    const state = getLaunchProgressState({
      currentSession: {
        status: "running",
        runState: {
          currentStage: "planning",
          progressPct: 8,
          timeline: [
            { at: "2026-04-22T00:00:00.000Z", stage: "planning", message: "Market intelligence: not_configured (none)", level: "info" },
          ],
        },
      } as never,
      hasCompletedBuild: false,
      hasSerpApiKey: false,
      isThriveDetected: false,
    });

    expect(state.currentStageLabel).toBe("Researching your market");
    expect(state.currentStageDescription).toContain("SerpAPI is unavailable");
  });

  it("marks completed state and 100 percent when build is done", () => {
    const state = getLaunchProgressState({
      currentSession: {
        status: "completed",
        runState: { currentStage: "completed", progressPct: 100, timeline: [] },
      } as never,
      hasCompletedBuild: true,
      hasSerpApiKey: true,
      isThriveDetected: true,
    });

    expect(state.isActiveBuild).toBe(false);
    expect(state.percentage).toBe(100);
    expect(state.currentStageLabel).toBe("Draft ready");
    expect(state.stages.every((stage, index) => (index < 7 ? stage.status === "completed" : stage.status === "current"))).toBe(true);
  });
});
