import type { Step2InternalState, Step2RecommendedAction } from "@/lib/directoryiq/step2SupportEngineContract";

const STEP2_IN_PROGRESS_STATES: ReadonlySet<Step2InternalState> = new Set([
  "researching",
  "brief_ready",
  "generating",
  "image_ready",
  "publishing",
]);

const STEP2_RETRY_STATES: ReadonlySet<Step2InternalState> = new Set([
  "failed",
  "needs_review",
  "published",
  "linked",
]);

export type Step2PrimaryAction =
  | { kind: "none" }
  | { kind: "run_pipeline"; label: "Create Support" | "Upgrade Support" | "Retry" };

export type Step2SecondaryAction =
  | { kind: "none" }
  | { kind: "view_post"; label: "View Post"; href: string };

export type Step2CardStatusLabel =
  | "Already Valid"
  | "Create Ready"
  | "Upgrade Ready"
  | "Creating"
  | "Publishing"
  | "Published"
  | "Needs Review"
  | "Failed";

export type Step2CardActionInput = {
  internalState: Step2InternalState;
  recommendedAction: Step2RecommendedAction;
  countsTowardRequiredFive: boolean;
  publishedUrl: string | null;
};

export function deriveStep2PrimaryAction(input: Omit<Step2CardActionInput, "publishedUrl">): Step2PrimaryAction {
  if (
    input.internalState === "confirmed_valid" ||
    input.internalState === "valid" ||
    (input.recommendedAction === "confirm" && input.countsTowardRequiredFive)
  ) {
    return { kind: "none" };
  }

  if (STEP2_IN_PROGRESS_STATES.has(input.internalState)) {
    return { kind: "none" };
  }

  if (STEP2_RETRY_STATES.has(input.internalState)) {
    return { kind: "run_pipeline", label: "Retry" };
  }

  if (input.recommendedAction === "upgrade") {
    return { kind: "run_pipeline", label: "Upgrade Support" };
  }

  if (input.recommendedAction === "create") {
    return { kind: "run_pipeline", label: "Create Support" };
  }

  return { kind: "none" };
}

export function deriveStep2SecondaryAction(input: Pick<Step2CardActionInput, "publishedUrl">): Step2SecondaryAction {
  if (!input.publishedUrl) {
    return { kind: "none" };
  }

  return {
    kind: "view_post",
    label: "View Post",
    href: input.publishedUrl,
  };
}

export function deriveStep2StatusLabel(input: Omit<Step2CardActionInput, "publishedUrl">): Step2CardStatusLabel {
  if (
    input.internalState === "confirmed_valid" ||
    input.internalState === "valid" ||
    (input.recommendedAction === "confirm" && input.countsTowardRequiredFive)
  ) {
    return "Already Valid";
  }

  if (STEP2_IN_PROGRESS_STATES.has(input.internalState)) {
    return input.internalState === "publishing" ? "Publishing" : "Creating";
  }

  if (input.internalState === "published" || input.internalState === "linked") {
    return "Published";
  }

  if (input.internalState === "failed") {
    return "Failed";
  }

  if (input.internalState === "needs_review") {
    return "Needs Review";
  }

  if (input.recommendedAction === "upgrade") {
    return "Upgrade Ready";
  }

  if (input.recommendedAction === "create") {
    return "Create Ready";
  }

  return "Needs Review";
}

export function shouldAllowStep2DraftGeneration(input: Omit<Step2CardActionInput, "publishedUrl">): boolean {
  const primary = deriveStep2PrimaryAction(input);
  return primary.kind === "run_pipeline" && primary.label !== "Retry";
}

export function shouldAllowStep2PipelineRun(input: Omit<Step2CardActionInput, "publishedUrl">): boolean {
  return deriveStep2PrimaryAction(input).kind === "run_pipeline";
}
