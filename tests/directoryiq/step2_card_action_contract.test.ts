import { describe, expect, it } from "vitest";

import {
  deriveSafeStep2BlockerMessage,
  deriveStep2SectionCta,
  deriveStep2PrimaryAction,
  deriveStep2SecondaryAction,
  deriveStep2StatusLabel,
  isStep2SetupBlockerMessage,
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

  it("prioritizes retry blocker at section level over write-next", () => {
    expect(
      deriveStep2SectionCta({
        globalSetupBlocked: false,
        items: [
          {
            slotId: "s1",
            primaryAction: { kind: "run_pipeline", label: "Try Again" },
            blockerMessage: "Draft validation failed for this article.",
          },
          {
            slotId: "s2",
            primaryAction: { kind: "run_pipeline", label: "Write Article" },
          },
        ],
      })
    ).toEqual({
      kind: "run_pipeline",
      slotId: "s1",
      label: "Try Again",
      blockerMessage: "Draft validation failed for this article.",
    });
  });

  it("uses write-next when no retry blocker exists", () => {
    expect(
      deriveStep2SectionCta({
        globalSetupBlocked: false,
        items: [
          {
            slotId: "s2",
            primaryAction: { kind: "run_pipeline", label: "Write Article" },
          },
        ],
      })
    ).toEqual({
      kind: "run_pipeline",
      slotId: "s2",
      label: "Write Next Article",
      blockerMessage: null,
    });
  });

  it("uses setup CTA when generation is globally blocked", () => {
    expect(
      deriveStep2SectionCta({
        globalSetupBlocked: true,
        items: [
          {
            slotId: "s2",
            primaryAction: { kind: "run_pipeline", label: "Write Article" },
          },
        ],
      })
    ).toEqual({
      kind: "setup",
      label: "Connect OpenAI in Signal Sources",
    });
  });

  it("maps setup retry blocker to fix-setup section CTA", () => {
    expect(
      deriveStep2SectionCta({
        globalSetupBlocked: false,
        items: [
          {
            slotId: "s1",
            primaryAction: { kind: "run_pipeline", label: "Try Again" },
            blockerMessage: "OpenAI API not configured. Go to DirectoryIQ -> Signal Sources.",
          },
        ],
      })
    ).toEqual({
      kind: "run_pipeline",
      slotId: "s1",
      label: "Fix Article Setup",
      blockerMessage: "OpenAI API not configured. Go to DirectoryIQ -> Signal Sources.",
    });
  });

  it("surfaces safe blocker text from code/message", () => {
    expect(deriveSafeStep2BlockerMessage({ code: "OPENAI_KEY_MISSING", message: "any" })).toBe(
      "OpenAI is not configured for this site."
    );
    expect(deriveSafeStep2BlockerMessage({ code: "OPENAI_TIMEOUT", message: "request timed out" })).toBe(
      "Upstream generation timed out."
    );
    expect(deriveSafeStep2BlockerMessage({ code: "DRAFT_VALIDATION_FAILED", message: "raw details" })).toBe(
      "Draft validation failed for this article."
    );
    expect(isStep2SetupBlockerMessage("authorization failed")).toBe(true);
  });
});
