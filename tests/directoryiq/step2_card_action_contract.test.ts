import { describe, expect, it } from "vitest";

import {
  deriveStep2PrimaryAction,
  deriveStep2SecondaryAction,
  deriveStep2StatusLabel,
  shouldAllowStep2DraftGeneration,
  shouldAllowStep2PipelineRun,
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
    ).toEqual({ kind: "run_pipeline", label: "Create Support" });

    expect(
      deriveStep2PrimaryAction({
        internalState: "not_started",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Upgrade Support" });
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
    ).toEqual({ kind: "run_pipeline", label: "Retry" });

    expect(
      deriveStep2PrimaryAction({
        internalState: "needs_review",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toEqual({ kind: "run_pipeline", label: "Retry" });
  });

  it("derives at most one passive secondary action", () => {
    expect(deriveStep2SecondaryAction({ publishedUrl: null })).toEqual({ kind: "none" });
    expect(deriveStep2SecondaryAction({ publishedUrl: "https://example.com/post" })).toEqual({
      kind: "view_post",
      label: "View Post",
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
    ).toBe("Create Ready");
    expect(
      deriveStep2StatusLabel({
        internalState: "not_started",
        recommendedAction: "upgrade",
        countsTowardRequiredFive: false,
      })
    ).toBe("Upgrade Ready");
    expect(
      deriveStep2StatusLabel({
        internalState: "brief_ready",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Creating");
    expect(
      deriveStep2StatusLabel({
        internalState: "publishing",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Publishing");
    expect(
      deriveStep2StatusLabel({
        internalState: "confirmed_valid",
        recommendedAction: "confirm",
        countsTowardRequiredFive: true,
      })
    ).toBe("Already Valid");
    expect(
      deriveStep2StatusLabel({
        internalState: "needs_review",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Needs Review");
    expect(
      deriveStep2StatusLabel({
        internalState: "failed",
        recommendedAction: "create",
        countsTowardRequiredFive: false,
      })
    ).toBe("Failed");
  });
});
