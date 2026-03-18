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
  | { kind: "run_pipeline"; label: "Write Article" | "Improve Article" | "Try Again" };

export type Step2SecondaryAction =
  | { kind: "none" }
  | { kind: "view_post"; label: "View Article"; href: string };

export type Step2CardStatusLabel =
  | "Live"
  | "Ready to Write"
  | "Needs Improvement"
  | "Working…"
  | "Needs Attention";

export type Step2SummaryBucket = {
  live: number;
  readyToWrite: number;
  needsAttention: number;
};

export type Step2SectionCta =
  | { kind: "none" }
  | { kind: "setup"; label: "Connect OpenAI in Signal Sources" }
  | {
      kind: "run_pipeline";
      slotId: string;
      label: "Try Again" | "Fix Article Setup" | "Write Next Article" | "Improve Next Article";
      blockerMessage: string | null;
    };

type Step2NextActionCandidateInput = {
  slotId: string;
  actionInput: Omit<Step2CardActionInput, "publishedUrl">;
};

type Step2SectionCtaInput = {
  globalSetupBlocked: boolean;
  items: Array<{
    slotId: string;
    primaryAction: Step2PrimaryAction;
    blockerMessage?: string | null;
  }>;
};

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
    return { kind: "run_pipeline", label: "Try Again" };
  }

  if (input.recommendedAction === "upgrade") {
    return { kind: "run_pipeline", label: "Improve Article" };
  }

  if (input.recommendedAction === "create") {
    return { kind: "run_pipeline", label: "Write Article" };
  }

  return { kind: "none" };
}

export function deriveStep2SecondaryAction(input: Pick<Step2CardActionInput, "publishedUrl">): Step2SecondaryAction {
  if (!input.publishedUrl) {
    return { kind: "none" };
  }

  return {
    kind: "view_post",
    label: "View Article",
    href: input.publishedUrl,
  };
}

export function deriveStep2StatusLabel(input: Omit<Step2CardActionInput, "publishedUrl">): Step2CardStatusLabel {
  if (
    input.internalState === "confirmed_valid" ||
    input.internalState === "valid" ||
    (input.recommendedAction === "confirm" && input.countsTowardRequiredFive)
  ) {
    return "Live";
  }

  if (STEP2_IN_PROGRESS_STATES.has(input.internalState)) {
    return "Working…";
  }

  if (input.internalState === "published" || input.internalState === "linked") {
    return "Needs Attention";
  }

  if (input.internalState === "failed") {
    return "Needs Attention";
  }

  if (input.internalState === "needs_review") {
    return "Needs Attention";
  }

  if (input.recommendedAction === "upgrade") {
    return "Needs Improvement";
  }

  if (input.recommendedAction === "create") {
    return "Ready to Write";
  }

  return "Needs Attention";
}

export function shouldAllowStep2DraftGeneration(input: Omit<Step2CardActionInput, "publishedUrl">): boolean {
  const primary = deriveStep2PrimaryAction(input);
  return primary.kind === "run_pipeline" && primary.label !== "Try Again";
}

export function shouldAllowStep2PipelineRun(input: Omit<Step2CardActionInput, "publishedUrl">): boolean {
  return deriveStep2PrimaryAction(input).kind === "run_pipeline";
}

export function summarizeStep2StatusBuckets(statuses: Step2CardStatusLabel[]): Step2SummaryBucket {
  return statuses.reduce<Step2SummaryBucket>(
    (acc, status) => {
      if (status === "Live") {
        acc.live += 1;
        return acc;
      }
      if (status === "Ready to Write" || status === "Needs Improvement") {
        acc.readyToWrite += 1;
        return acc;
      }
      if (status === "Needs Attention") {
        acc.needsAttention += 1;
      }
      return acc;
    },
    { live: 0, readyToWrite: 0, needsAttention: 0 }
  );
}

export function pickStep2NextActionCandidate(
  items: Step2NextActionCandidateInput[]
): { slotId: string; primaryAction: Exclude<Step2PrimaryAction, { kind: "none" }> } | null {
  const candidates = items
    .map((item) => {
      const primaryAction = deriveStep2PrimaryAction(item.actionInput);
      if (primaryAction.kind !== "run_pipeline") return null;
      return {
        slotId: item.slotId,
        primaryAction,
      };
    })
    .filter((item): item is { slotId: string; primaryAction: Exclude<Step2PrimaryAction, { kind: "none" }> } => Boolean(item));

  const createCandidate = candidates.find((item) => item.primaryAction.label === "Write Article");
  if (createCandidate) return createCandidate;
  const improveCandidate = candidates.find((item) => item.primaryAction.label === "Improve Article");
  if (improveCandidate) return improveCandidate;
  return candidates[0] ?? null;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

export function isStep2SetupBlockerMessage(value: string | null | undefined): boolean {
  const lower = normalizeText(value).toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("openai_key_missing") ||
    lower.includes("openai api not configured") ||
    lower.includes("openai is not configured for this site") ||
    lower.includes("authenticate") ||
    lower.includes("authorization") ||
    lower.includes("token invalid")
  );
}

export function deriveSafeStep2BlockerMessage(input: {
  message?: string | null;
  code?: string | null;
}): string {
  const code = normalizeText(input.code).toUpperCase();
  const message = normalizeText(input.message);
  const lower = message.toLowerCase();

  if (code === "OPENAI_KEY_MISSING" || isStep2SetupBlockerMessage(message)) {
    return "OpenAI is not configured for this site.";
  }
  if (code === "OPENAI_TIMEOUT" || lower.includes("timed out") || lower.includes("timeout")) {
    return "Upstream generation timed out.";
  }
  if (code === "DRAFT_VALIDATION_FAILED" || lower.includes("draft failed governance validation")) {
    return "Draft validation failed for this article.";
  }
  if (code === "OPENAI_AUTH" || lower.includes("authenticate") || lower.includes("authorization")) {
    return "Site connection needs attention.";
  }
  if (code === "OPENAI_UPSTREAM" || code === "OPENAI_RATE_LIMIT") {
    return "Article generation is temporarily unavailable.";
  }
  if (!message) return "We couldn't start this article right now. Please try again.";
  return message;
}

export function deriveStep2SectionCta(input: Step2SectionCtaInput): Step2SectionCta {
  if (input.globalSetupBlocked) {
    return { kind: "setup", label: "Connect OpenAI in Signal Sources" };
  }

  for (const item of input.items) {
    if (item.primaryAction.kind !== "run_pipeline") continue;
    if (item.primaryAction.label === "Try Again") {
      const blockerMessage = normalizeText(item.blockerMessage) || null;
      return {
        kind: "run_pipeline",
        slotId: item.slotId,
        label: isStep2SetupBlockerMessage(blockerMessage) ? "Fix Article Setup" : "Try Again",
        blockerMessage,
      };
    }
    if (item.primaryAction.label === "Write Article") {
      return {
        kind: "run_pipeline",
        slotId: item.slotId,
        label: "Write Next Article",
        blockerMessage: null,
      };
    }
    if (item.primaryAction.label === "Improve Article") {
      return {
        kind: "run_pipeline",
        slotId: item.slotId,
        label: "Improve Next Article",
        blockerMessage: null,
      };
    }
  }

  return { kind: "none" };
}
