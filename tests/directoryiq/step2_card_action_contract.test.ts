import { describe, expect, it } from "vitest";

import {
  deriveStep2PrimaryAction,
  deriveStep2SecondaryAction,
  deriveStep2StatusLabel,
  pickStep2NextActionCandidate,
  shouldAllowStep2DraftGeneration,
  shouldAllowStep2PipelineRun,
  summarizeStep2StatusBuckets,
} from "@/lib/directoryiq/step2CardActionContract";

describe("step2 card action contract", () => {
  it("hides execution actions for already valid slots", () => {
    const primary = deriveStep2PrimaryAction({
      internalState: "confirmed_valid",
      recommendedAction: "confirm",
      countsTowardRequiredFive: true,
    });

    expect(primary).toEqual({ kind: "none" });
  });

  it("shows create and upgrade as single truthful primary actions", () => {
    expect(
      deriveStep2PrimaryAction({
        internalState: "not_started",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Write Article" });

    expect(
      deriveStep2PrimaryAction({
        internalState: "not_started",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Improve Article" });
  });

  it("hides primary actions while in progress", () => {
    const inProgressStates = ["researching", "brief_ready", "generating", "image_ready", "publishing"] as const;

    for (const internalState of inProgressStates) {
      const primary = deriveStep2PrimaryAction({
        internalState,
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      });

      expect(primary).toEqual({ kind: "none" });
      expect(
        shouldAllowStep2PipelineRun({
          internalState,
          recommendedAction: "create",
          countsTowardRequiredFive: false,
        })
      ).toBe(false);
    }
  });

  it("blocks draft generation for valid/in-progress states and allows actionable create state", () => {
    expect(
      shouldAllowStep2DraftGeneration({
        internalState: "confirmed_valid",
        recommendedAction: "confirm",
        countsTowardRequiredFive: true,
      })
    ).toBe(false);

    expect(
      shouldAllowStep2DraftGeneration({
        internalState: "generating",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe(false);

    expect(
      shouldAllowStep2DraftGeneration({
        internalState: "not_started",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe(true);
  });

  it("maps failed or needs-review states to retry", () => {
    expect(
      deriveStep2PrimaryAction({
        internalState: "failed",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Try Again" });

    expect(
      deriveStep2PrimaryAction({
        internalState: "needs_review",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Try Again" });
  });

  it("derives at most one passive secondary action", () => {
    expect(deriveStep2SecondaryAction({ publishedUrl: null })).toEqual({ kind: "none" });
    expect(deriveStep2SecondaryAction({ publishedUrl: "https://example.com/post" })).toEqual({
      kind: "view_post",
      label: "View Article",
      href: "https://example.com/post",
    });
  });

  it("derives deterministic status labels for ready, in-progress, valid, and recovery states", () => {
    expect(
      deriveStep2StatusLabel({
        internalState: "not_started",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Ready to Write");
    expect(
      deriveStep2StatusLabel({
        internalState: "not_started",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toBe("Needs Improvement");
    expect(
      deriveStep2StatusLabel({
        internalState: "brief_ready",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Working…");
    expect(
      deriveStep2StatusLabel({
        internalState: "publishing",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Working…");
    expect(
      deriveStep2StatusLabel({
        internalState: "confirmed_valid",
        recommendedAction: "confirm",
        countsTowardRequiredFive: true,
      })
    ).toBe("Live");
    expect(
      deriveStep2StatusLabel({
        internalState: "needs_review",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Needs Attention");
    expect(
      deriveStep2StatusLabel({
        internalState: "failed",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Needs Attention");
  });

  it("summarizes status buckets for top-level Step 2 progress chips", () => {
    expect(
      summarizeStep2StatusBuckets(["Live", "Ready to Write", "Needs Improvement", "Working…", "Needs Attention"])
    ).toEqual({
      live: 1,
      readyToWrite: 2,
      needsAttention: 1,
    });
  });

  it("picks the best write-next candidate in deterministic priority", () => {
    expect(
      pickStep2NextActionCandidate([
        {
          slotId: "s1",
          actionInput: { internalState: "not_started", recommendedAction: "upgrade", countsTowardRequiredFive: false },
        },
        {
          slotId: "s2",
          actionInput: { internalState: "not_started", recommendedAction: "create", countsTowardRequiredFive: false },
        },
      ])
    ).toEqual({
      slotId: "s2",
      primaryAction: { kind: "run_pipeline", label: "Write Article" },
    });

    expect(
      pickStep2NextActionCandidate([
        {
          slotId: "s1",
          actionInput: { internalState: "needs_review", recommendedAction: "create", countsTowardRequiredFive: false },
        },
      ])
    ).toEqual({
      slotId: "s1",
      primaryAction: { kind: "run_pipeline", label: "Try Again" },
    });
  });
});
