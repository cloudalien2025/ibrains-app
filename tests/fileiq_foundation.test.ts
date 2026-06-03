import { afterEach, describe, expect, it, vi } from "vitest";

import { fileIqNavItems } from "@/lib/fileiq/fileiq-nav";
import {
  fileIqDownstreamBrains,
  isFileIqExtractionJobStatus,
  isFileIqValidationStatus,
  isFileIqReviewStatus,
  isFileIqDownstreamBrain,
} from "@/lib/fileiq/fileiq-status";
import { fileIqDatabaseBoundary, fileIqPlannedTables } from "@/lib/fileiq/fileiq-schema";

// Mock the Claude Agent SDK so the real CLI-spawning runtime never loads in tests.
const queryMock = vi.fn();
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (params: unknown) => queryMock(params),
}));

import {
  FILEIQ_AGENT_ALLOWED_TOOLS,
  FILEIQ_AGENT_API_KEY_ENV,
  FILEIQ_AGENT_DEFAULT_MODEL,
  buildFileIqAgentOptions,
  resolveFileIqAgentApiKey,
  runFileIqExtractionAgent,
} from "@/lib/fileiq/agent/fileiq-agent";

async function* streamMessages(messages: unknown[]) {
  for (const message of messages) {
    yield message;
  }
}

afterEach(() => {
  queryMock.mockReset();
  delete process.env[FILEIQ_AGENT_API_KEY_ENV];
});

describe("FileIQ navigation contract", () => {
  it("exposes the ten Phase 1.0 nav destinations starting at the command center", () => {
    expect(fileIqNavItems).toHaveLength(10);
    expect(fileIqNavItems[0]).toEqual({ label: "Command Center", href: "/fileiq", ready: true });
    expect(fileIqNavItems.map((item) => item.label)).toEqual([
      "Command Center",
      "Source Bundles",
      "Suppliers",
      "Files",
      "Extraction Jobs",
      "Packages",
      "Review Queue",
      "Validation Reports",
      "Brain Outputs",
      "Settings",
    ]);
    for (const item of fileIqNavItems) {
      expect(item.href.startsWith("/fileiq")).toBe(true);
    }
  });

  it("marks only the built Command Center route as ready in Phase 1.0", () => {
    // Guards against linking the sidebar to unbuilt routes, which would render
    // the not-found boundary (404, or 500 during a Turbopack cold-start window).
    const ready = fileIqNavItems.filter((item) => item.ready);
    expect(ready).toEqual([{ label: "Command Center", href: "/fileiq", ready: true }]);
    expect(fileIqNavItems.filter((item) => !item.ready)).toHaveLength(9);
  });
});

describe("FileIQ status guards", () => {
  it("validates extraction job, validation, review, and downstream-brain values", () => {
    expect(isFileIqExtractionJobStatus("running")).toBe(true);
    expect(isFileIqExtractionJobStatus("nope")).toBe(false);
    expect(isFileIqValidationStatus("visual_only")).toBe(true);
    expect(isFileIqValidationStatus("nope")).toBe(false);
    expect(isFileIqReviewStatus("approved")).toBe(true);
    expect(isFileIqReviewStatus("nope")).toBe(false);
    expect(isFileIqDownstreamBrain("optipixel")).toBe(true);
    expect(isFileIqDownstreamBrain("nope")).toBe(false);
  });
});

describe("FileIQ shared-DB boundary", () => {
  it("is planning-only on the shared ecommerce DB and targets the five downstream brains", () => {
    expect(fileIqDatabaseBoundary.migrationState).toBe("planning_only");
    expect(fileIqDatabaseBoundary.sharedDatabaseEnvVar).toBe("ECOMMERCE_DATABASE_URL");
    expect(fileIqDatabaseBoundary.downstreamBrains).toEqual([...fileIqDownstreamBrains]);
    expect(fileIqDatabaseBoundary.writeTables).toEqual(fileIqPlannedTables);
  });

  it("plans the canonical extraction-job table that carries the agent session id", () => {
    expect(fileIqPlannedTables).toContain("fileiq_extraction_jobs");
  });
});

describe("FileIQ agent option contract", () => {
  it("builds bounded options with the default model and allowed tool registry", () => {
    const options = buildFileIqAgentOptions({
      jobId: "job_1",
      bundleId: "bundle_1",
      prompt: "Extract supplement facts from the source file.",
    });

    expect(options.model).toBe(FILEIQ_AGENT_DEFAULT_MODEL);
    expect(options.allowedTools).toEqual([...FILEIQ_AGENT_ALLOWED_TOOLS]);
    expect(options.permissionMode).toBe("default");
    expect(options.settingSources).toEqual([]);
    // File reading, web fetch, bash, and vision dedupe to three SDK tools.
    expect(FILEIQ_AGENT_ALLOWED_TOOLS).toEqual(["Read", "WebFetch", "Bash"]);
  });

  it("honors model and turn overrides", () => {
    const options = buildFileIqAgentOptions({
      jobId: "job_2",
      bundleId: "bundle_1",
      prompt: "Extract.",
      model: "claude-sonnet-4-6",
      maxTurns: 5,
    });
    expect(options.model).toBe("claude-sonnet-4-6");
    expect(options.maxTurns).toBe(5);
  });
});

describe("FileIQ extraction agent runner", () => {
  it("degrades to unavailable when ANTHROPIC_API_KEY is missing", async () => {
    const result = await runFileIqExtractionAgent({
      jobId: "job_3",
      bundleId: "bundle_1",
      prompt: "Extract.",
    });

    expect(result.status).toBe("unavailable");
    expect(result.errorCode).toBe("agent_credentials_missing");
    expect(result.agentSessionId).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("captures the agent session id and completes on a success result", async () => {
    process.env[FILEIQ_AGENT_API_KEY_ENV] = "test-key";
    queryMock.mockReturnValue(
      streamMessages([
        { type: "system", subtype: "init", session_id: "sess_abc" },
        {
          type: "result",
          subtype: "success",
          result: "Extracted 1 product fact.",
          num_turns: 2,
          total_cost_usd: 0.01,
          session_id: "sess_abc",
        },
      ]),
    );

    const result = await runFileIqExtractionAgent({
      jobId: "job_4",
      bundleId: "bundle_1",
      prompt: "Extract.",
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("completed");
    expect(result.agentSessionId).toBe("sess_abc");
    expect(result.resultText).toBe("Extracted 1 product fact.");
    expect(result.numTurns).toBe(2);
    expect(result.errorCode).toBeNull();
  });

  it("maps an error result to failed while preserving the captured session id", async () => {
    process.env[FILEIQ_AGENT_API_KEY_ENV] = "test-key";
    queryMock.mockReturnValue(
      streamMessages([
        { type: "system", subtype: "init", session_id: "sess_err" },
        {
          type: "result",
          subtype: "error_max_turns",
          num_turns: 24,
          total_cost_usd: 0.5,
          session_id: "sess_err",
        },
      ]),
    );

    const result = await runFileIqExtractionAgent({
      jobId: "job_5",
      bundleId: "bundle_1",
      prompt: "Extract.",
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("error_max_turns");
    expect(result.agentSessionId).toBe("sess_err");
  });

  it("returns agent_no_result when the stream ends without a result message", async () => {
    process.env[FILEIQ_AGENT_API_KEY_ENV] = "test-key";
    queryMock.mockReturnValue(
      streamMessages([{ type: "system", subtype: "init", session_id: "sess_none" }]),
    );

    const result = await runFileIqExtractionAgent({
      jobId: "job_6",
      bundleId: "bundle_1",
      prompt: "Extract.",
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("agent_no_result");
    expect(result.agentSessionId).toBe("sess_none");
  });

  it("resolves the api key only when set and non-blank", () => {
    expect(resolveFileIqAgentApiKey()).toBeNull();
    process.env[FILEIQ_AGENT_API_KEY_ENV] = "   ";
    expect(resolveFileIqAgentApiKey()).toBeNull();
    process.env[FILEIQ_AGENT_API_KEY_ENV] = "real-key";
    expect(resolveFileIqAgentApiKey()).toBe("real-key");
  });
});
