import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { FileIqExtractionJobStatus } from "@/lib/fileiq/fileiq-status";

/** Public alias for the Agent SDK options contract used across FileIQ. */
export type ClaudeAgentOptions = Options;

/** Environment variable that supplies the model credential for the Agent SDK. */
export const FILEIQ_AGENT_API_KEY_ENV = "ANTHROPIC_API_KEY" as const;

/** Default model for FileIQ extraction sessions. */
export const FILEIQ_AGENT_DEFAULT_MODEL = "claude-opus-4-8" as const;

/**
 * Logical capabilities a FileIQ extraction session may use, mapped to the
 * Agent SDK built-in tool names that back them. "vision" is served by the
 * `Read` tool (image-capable file reads); there is no separate vision tool.
 */
export const FILEIQ_AGENT_TOOLS = {
  fileReading: "Read",
  webFetch: "WebFetch",
  bash: "Bash",
  vision: "Read",
} as const;

export type FileIqAgentCapability = keyof typeof FILEIQ_AGENT_TOOLS;

/** Deduplicated list of SDK tool names the extraction agent is allowed to call. */
export const FILEIQ_AGENT_ALLOWED_TOOLS: readonly string[] = Array.from(
  new Set(Object.values(FILEIQ_AGENT_TOOLS)),
);

const FILEIQ_AGENT_SYSTEM_PROMPT = [
  "You are the FileIQ extraction agent.",
  "Your job is to ingest a supplier source file and extract structured, provenance-tracked product facts.",
  "Only report facts you can ground in the source. Never invent values.",
  "When a fact cannot be proven from the source, mark it missing rather than guessing.",
  "Preserve provenance (file, page/sheet/row, extraction method, confidence) for every fact you emit.",
].join(" ");

export interface FileIqAgentJobInput {
  /** FileIQ extraction job id this session is executing. */
  jobId: string;
  /** Source bundle the job belongs to. */
  bundleId: string;
  /** Instruction prompt describing the extraction task for this source file. */
  prompt: string;
  /** Working directory the agent may read from. Defaults to process.cwd(). */
  cwd?: string;
  /** Additional read-only directories the agent may access (absolute paths). */
  additionalDirectories?: string[];
  /** Upper bound on agent turns for a single extraction session. */
  maxTurns?: number;
  /** Model override; defaults to {@link FILEIQ_AGENT_DEFAULT_MODEL}. */
  model?: string;
  /** Caller-provided controller so the session can be cancelled/retried. */
  abortController?: AbortController;
}

/**
 * Build the Agent SDK option contract for a FileIQ extraction session.
 *
 * Pure and side-effect free: it constructs options only and never starts a
 * session, so it is safe to unit test and to call from non-runtime contexts.
 */
export function buildFileIqAgentOptions(input: FileIqAgentJobInput): ClaudeAgentOptions {
  return {
    model: input.model ?? FILEIQ_AGENT_DEFAULT_MODEL,
    systemPrompt: FILEIQ_AGENT_SYSTEM_PROMPT,
    allowedTools: [...FILEIQ_AGENT_ALLOWED_TOOLS],
    permissionMode: "default",
    cwd: input.cwd,
    additionalDirectories: input.additionalDirectories,
    maxTurns: input.maxTurns ?? 24,
    abortController: input.abortController,
    // FileIQ does not inherit local CLI settings/skills for headless extraction.
    settingSources: [],
  };
}

/** Returns the configured Anthropic API key, or null when unset/blank. */
export function resolveFileIqAgentApiKey(): string | null {
  const value = process.env[FILEIQ_AGENT_API_KEY_ENV];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type FileIqAgentRunStatus = Extract<
  FileIqExtractionJobStatus,
  "completed" | "failed"
> | "unavailable";

export interface FileIqAgentRunResult {
  jobId: string;
  bundleId: string;
  /** Agent session id, persisted to fileiq_extraction_jobs.agent_session_id. */
  agentSessionId: string | null;
  status: FileIqAgentRunStatus;
  /** Final agent result text when the session succeeds. */
  resultText: string | null;
  /** Stable failure/availability code; null on success. */
  errorCode: string | null;
  errorMessage: string | null;
  numTurns: number;
  totalCostUsd: number | null;
}

/**
 * Run a single FileIQ extraction job as a Claude Agent SDK session.
 *
 * Explicit-invocation only. Captures the agent `session_id` from the first
 * streamed message so callers can persist it for monitoring/retry, then
 * resolves the terminal `result` message into a stable {@link FileIqAgentRunResult}.
 *
 * If `ANTHROPIC_API_KEY` is absent this degrades safely to an `unavailable`
 * result instead of throwing, matching the EcomViper `generation_unavailable`
 * degradation pattern.
 */
export async function runFileIqExtractionAgent(
  input: FileIqAgentJobInput,
): Promise<FileIqAgentRunResult> {
  const base: Omit<FileIqAgentRunResult, "status" | "errorCode" | "errorMessage"> = {
    jobId: input.jobId,
    bundleId: input.bundleId,
    agentSessionId: null,
    resultText: null,
    numTurns: 0,
    totalCostUsd: null,
  };

  if (!resolveFileIqAgentApiKey()) {
    return {
      ...base,
      status: "unavailable",
      errorCode: "agent_credentials_missing",
      errorMessage: `Set ${FILEIQ_AGENT_API_KEY_ENV} to run FileIQ extraction sessions.`,
    };
  }

  const options = buildFileIqAgentOptions(input);
  let agentSessionId: string | null = null;

  try {
    const session = query({ prompt: input.prompt, options });

    for await (const message of session) {
      // Every SDK message carries the session id; capture it once, as early
      // as possible, so a caller can persist it even on later failure.
      if (!agentSessionId && "session_id" in message && message.session_id) {
        agentSessionId = message.session_id;
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          return {
            ...base,
            agentSessionId: agentSessionId ?? message.session_id ?? null,
            status: "completed",
            resultText: message.result,
            errorCode: null,
            errorMessage: null,
            numTurns: message.num_turns,
            totalCostUsd: message.total_cost_usd,
          };
        }

        return {
          ...base,
          agentSessionId: agentSessionId ?? message.session_id ?? null,
          status: "failed",
          errorCode: message.subtype,
          errorMessage: `FileIQ extraction agent ended with ${message.subtype}.`,
          numTurns: message.num_turns,
          totalCostUsd: message.total_cost_usd,
        };
      }
    }

    // Stream ended without a terminal result message.
    return {
      ...base,
      agentSessionId,
      status: "failed",
      errorCode: "agent_no_result",
      errorMessage: "FileIQ extraction agent stream ended without a result message.",
    };
  } catch (error) {
    return {
      ...base,
      agentSessionId,
      status: "failed",
      errorCode: "agent_session_error",
      errorMessage: error instanceof Error ? error.message : "Unknown agent session error.",
    };
  }
}
