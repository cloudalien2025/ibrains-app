#!/usr/bin/env npx
// FileIQ background extraction worker.
//
// Polls fileiq_extraction_jobs for pending jobs, claims each as 'running',
// runs the extraction strategy (deterministic local preparse + compact Claude
// validation, or full Claude Agent SDK), then updates the job to 'completed'
// or 'failed' and writes the raw extraction.
//
// Usage (dev):
//   npx --yes tsx scripts/fileiq-worker.ts
//
// Usage (production systemd service):
//   See fileiq-worker.service in the repo root.

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  claimFileIqPendingJob,
  updateFileIqExtractionJob,
  insertFileIqRawExtraction,
} from "@/lib/fileiq/fileiq-db-core";
import { runFileIqExtractionAgent } from "@/lib/fileiq/agent/fileiq-agent-core";
import {
  extractJsonFromAgentResult,
  detectProductCatalogSummary,
} from "@/lib/fileiq/result-parser";
import { parseRocktomicInventoryCsv } from "@/lib/fileiq/csv/rocktomic-inventory-parser";

const LOG = "[fileiq:worker]";
const POLL_INTERVAL_MS = 5_000;

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface WorkerContext {
  agentPrompt: string;
  cwd: string | null;
  additionalDirectories: string[];
  maxTurns: number;
  route?: string;
  routeRationale?: string;
  filePaths?: Array<{ path: string; type: string }>;
  urls?: string[];
}

const DETERMINISTIC_VALIDATION_MAX_TURNS = 3;

/** Typed result from a successful deterministic CSV preparse. */
interface CsvPreparseResult {
  payload: Record<string, unknown>;
  productCount: number;
  confidence: "high" | "low";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickNonEmptyFields(
  source: unknown,
  keys: string[],
): Record<string, unknown> | undefined {
  if (!isRecord(source)) return undefined;
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    picked[key] = value;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function buildCompactPreparedEvidence(preparse: CsvPreparseResult): Record<string, unknown> {
  const payload = preparse.payload;
  const products = Array.isArray(payload.products) ? payload.products : [];
  return {
    schemaType: "product_catalog",
    schemaVersion: "1.1",
    supplier: isRecord(payload.supplier) ? payload.supplier : undefined,
    products: products.map((product) => {
      if (!isRecord(product)) return product;
      const compact: Record<string, unknown> = {
        sku: product.sku,
        productName: product.productName,
        productType: product.productType,
        category: product.category,
      };
      const inventory = pickNonEmptyFields(product.inventory, [
        "status",
        "quantityOnHand",
        "replenishmentEta",
        "accessLevel",
        "lastUpdated",
      ]);
      const pricing = pickNonEmptyFields(product.pricing, [
        "msrp",
        "wholesaleCost",
        "currency",
        "mapPrice",
        "salePrice",
      ]);
      const extraction = pickNonEmptyFields(product.extraction, [
        "sourceRef",
        "confidence",
        "extractionNotes",
      ]);
      if (inventory) compact.inventory = inventory;
      if (pricing) compact.pricing = pricing;
      if (extraction) compact.extraction = extraction;
      return compact;
    }),
    totalProductsFound: preparse.productCount,
    sourcesProcessed: payload.sourcesProcessed ?? 1,
  };
}

function extractValidationProductCount(payload: Record<string, unknown>): number | null {
  if (typeof payload.validatedProductCount === "number") return payload.validatedProductCount;
  if (typeof payload.totalProductsFound === "number") return payload.totalProductsFound;
  if (Array.isArray(payload.productsValidated)) return payload.productsValidated.length;
  if (Array.isArray(payload.products)) return payload.products.length;
  return null;
}

function resolveAgentMaxTurns(ctx: WorkerContext): number {
  if (ctx.route === "deterministic_structured") {
    // Defensive clamp: deterministic CSV validation must never run with 0 turns.
    return DETERMINISTIC_VALIDATION_MAX_TURNS;
  }
  return ctx.maxTurns > 0 ? ctx.maxTurns : 40;
}

function extractWorkerContext(
  summary: Record<string, unknown>,
): WorkerContext | null {
  const workerCtx = summary["_worker"];
  if (
    !workerCtx ||
    typeof workerCtx !== "object" ||
    typeof (workerCtx as Record<string, unknown>)["agentPrompt"] !== "string"
  ) {
    return null;
  }
  const ctx = workerCtx as Record<string, unknown>;
  return {
    agentPrompt: ctx["agentPrompt"] as string,
    cwd: typeof ctx["cwd"] === "string" ? ctx["cwd"] : null,
    additionalDirectories: Array.isArray(ctx["additionalDirectories"])
      ? (ctx["additionalDirectories"] as string[])
      : [],
    maxTurns: typeof ctx["maxTurns"] === "number" ? ctx["maxTurns"] : 40,
    route: typeof ctx["route"] === "string" ? ctx["route"] : undefined,
    routeRationale:
      typeof ctx["routeRationale"] === "string" ? ctx["routeRationale"] : undefined,
    filePaths: Array.isArray(ctx["filePaths"])
      ? (ctx["filePaths"] as Array<{ path: string; type: string }>)
      : undefined,
    urls: Array.isArray(ctx["urls"]) ? (ctx["urls"] as string[]) : undefined,
  };
}

/**
 * Attempt deterministic CSV extraction for the Rocktomic inventory format.
 * Returns the parsed result if confidence is high, or null to fall back.
 */
async function tryDeterministicCsvExtraction(
  ctx: WorkerContext,
  jobId: string,
): Promise<CsvPreparseResult | null> {
  if (!ctx.filePaths || ctx.filePaths.length === 0) return null;

  const csvFiles = ctx.filePaths.filter(
    (f) =>
      f.type === "csv" ||
      f.path.toLowerCase().endsWith(".csv"),
  );
  if (csvFiles.length === 0) return null;

  const csvFile = csvFiles[0];
  let content: string;
  try {
    content = await fs.readFile(csvFile.path, "utf8");
  } catch (err) {
    console.warn(
      `${LOG} jobId=${jobId} | CSV read failed | path=${csvFile.path} error=${normalizeError(err)}`,
    );
    return null;
  }

  const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(path.basename(csvFile.path));
  const reportDate = dateMatch ? dateMatch[1] : undefined;

  const result = parseRocktomicInventoryCsv(content, reportDate);
  console.log(
    `${LOG} jobId=${jobId} | deterministic CSV parse | confidence=${result.confidence} productCount=${result.productCount}`,
  );

  if (result.confidence === "low") {
    if (result.parseNotes.length > 0) {
      console.warn(
        `${LOG} jobId=${jobId} | CSV parse low confidence | notes=${result.parseNotes.join("; ")}`,
      );
    }
    return null;
  }

  return {
    payload: result.payload,
    productCount: result.productCount,
    confidence: result.confidence,
  };
}

/**
 * Build a compact Claude validation prompt from a pre-parsed CSV result.
 * Does NOT include the full schema example block — the prepared evidence IS
 * the source of truth; Claude only needs to validate and normalize.
 */
function buildCompactValidationPrompt(
  jobId: string,
  preparse: CsvPreparseResult,
): string {
  const compactEvidence = buildCompactPreparedEvidence(preparse);
  return [
    `You are finalizing a FileIQ Product Catalog extraction for job ${jobId}.`,
    ``,
    `The source CSV has been pre-parsed locally. Below is the complete prepared evidence — ${preparse.productCount} products extracted with ${preparse.confidence} confidence.`,
    `PREPARED EVIDENCE.products is the full product list. It is not a sample or summary.`,
    ``,
    `PREPARED EVIDENCE:`,
    JSON.stringify(compactEvidence, null, 2),
    `END PREPARED EVIDENCE`,
    ``,
    `TASK: Validate every product row in the prepared evidence above. Normalize any field values if needed (e.g. status enums, null fields you can infer from context) and report validation status for the final product_catalog v1.1 payload.`,
    `You must preserve all ${preparse.productCount} products from PREPARED EVIDENCE.products. Do not summarize, sample, truncate, or return only the first product.`,
    `Set validatedProductCount to ${preparse.productCount}.`,
    `Do not return the full product_catalog; the worker will persist the complete deterministic product_catalog v1.1 payload after your validation.`,
    ``,
    `CRITICAL OUTPUT RULES — follow exactly:`,
    `  1. Output ONLY valid JSON. No prose before or after the JSON.`,
    `  2. Do NOT wrap the JSON in markdown code fences (no \`\`\` or \`\`\`json).`,
    `  3. Your entire response must be parseable by JSON.parse().`,
    `  4. Do NOT reread the source file — use the prepared evidence as your primary source.`,
    `  5. Return this exact JSON shape: {"schemaType":"product_catalog","schemaVersion":"1.1","validationStatus":"validated","validatedProductCount":${preparse.productCount},"normalizationNotes":[]}.`,
  ].join("\n");
}

/**
 * Store the deterministic preparse payload directly when agent validation
 * is unavailable or has failed. Used as a fallback in the deterministic path.
 */
async function storeDeterministicFallback(
  jobId: string,
  csvParseResult: CsvPreparseResult,
  preparseMs: number,
  jobStartMs: number,
  ctx: WorkerContext,
  agentDurationMs?: number,
  fallbackReason?: string,
): Promise<void> {
  const catalogSummary = detectProductCatalogSummary(csvParseResult.payload);

  const insertStartMs = Date.now();
  try {
    await insertFileIqRawExtraction({
      id: randomUUID(),
      extractionJobId: jobId,
      sourceFileId: null,
      artifactType: "deterministic_result",
      storageUri: "inline:payload",
      payload: csvParseResult.payload,
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | raw extraction insert failed (fallback) | error=${normalizeError(err)}`,
    );
  }
  const insertMs = Date.now() - insertStartMs;
  const totalMs = Date.now() - jobStartMs;

  try {
    await updateFileIqExtractionJob(jobId, {
      status: "completed",
      agentSessionId: null,
      errorCode: null,
      errorMessage: null,
      summary: {
        totalProductsFound: csvParseResult.productCount,
        agentStatus: "fallback_deterministic",
        numTurns: 0,
        agentOrchestration: true,
        localPreparse: {
          parser: "rocktomic_inventory_csv",
          productsParsed: csvParseResult.productCount,
          confidence: csvParseResult.confidence,
        },
        ...(catalogSummary !== null && {
          schemaType: catalogSummary.schemaType,
          schemaVersion: catalogSummary.schemaVersion,
        }),
        _timing: {
          preparseMs,
          ...(typeof agentDurationMs === "number" && { agentDurationMs }),
          insertMs,
          totalMs,
          route: ctx.route,
          agentFallback: true,
          ...(fallbackReason && { fallbackReason }),
        },
      },
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | DB update failed (fallback) | error=${normalizeError(err)}`,
    );
  }
}

export async function processFileIqJob(
  jobId: string,
  bundleId: string,
  ctx: WorkerContext,
): Promise<void> {
  const jobStartMs = Date.now();
  const effectiveAgentMaxTurns = resolveAgentMaxTurns(ctx);

  console.log(
    `${LOG} jobId=${jobId} | starting | route=${ctx.route ?? "agent_unstructured"} maxTurns=${effectiveAgentMaxTurns} cwd=${ctx.cwd ?? "none"}`,
  );

  // ── Deterministic preparse (structured route) ──────────────────────────────
  // For CSV jobs: parse locally first, then run Claude with a compact prompt
  // containing the prepared evidence. Claude validates/normalizes instead of
  // manually reading the full source row by row.
  if (ctx.route === "deterministic_structured") {
    const prepStartMs = Date.now();
    const csvParseResult = await tryDeterministicCsvExtraction(ctx, jobId);
    const preparseMs = Date.now() - prepStartMs;

    if (csvParseResult !== null) {
      // High confidence — build compact prompt and run Claude for validation
      const compactPrompt = buildCompactValidationPrompt(jobId, csvParseResult);
      console.log(
        `${LOG} jobId=${jobId} | preparse complete | productCount=${csvParseResult.productCount} preparseMs=${preparseMs} — starting agent validation maxTurns=${effectiveAgentMaxTurns}`,
      );

      const agentStartMs = Date.now();
      let agentResult;
      try {
        agentResult = await runFileIqExtractionAgent({
          jobId,
          bundleId,
          prompt: compactPrompt,
          cwd: ctx.cwd ?? undefined,
          additionalDirectories:
            ctx.additionalDirectories.length > 0 ? ctx.additionalDirectories : undefined,
          maxTurns: effectiveAgentMaxTurns,
        });
      } catch (err) {
        const agentDurationMs = Date.now() - agentStartMs;
        console.warn(
          `${LOG} jobId=${jobId} | agent validation threw — using deterministic result | error=${normalizeError(err)} durationMs=${agentDurationMs}`,
        );
        await storeDeterministicFallback(
          jobId,
          csvParseResult,
          preparseMs,
          jobStartMs,
          ctx,
          agentDurationMs,
          "agent_exception",
        );
        return;
      }

      const agentDurationMs = Date.now() - agentStartMs;
      console.log(
        `${LOG} jobId=${jobId} | agent validation returned | status=${agentResult.status} numTurns=${agentResult.numTurns} durationMs=${agentDurationMs}`,
      );

      if (agentResult.status !== "completed") {
        console.warn(
          `${LOG} jobId=${jobId} | agent validation status=${agentResult.status} — using deterministic result`,
        );
        await storeDeterministicFallback(
          jobId,
          csvParseResult,
          preparseMs,
          jobStartMs,
          ctx,
          agentDurationMs,
          `agent_${agentResult.status}`,
        );
        return;
      }

      // Parse agent result
      const parseStartMs = Date.now();
      let validationPayload: Record<string, unknown> = {};
      const catalogSummary = detectProductCatalogSummary(csvParseResult.payload);
      let parseMode = "none";

      if (agentResult.resultText) {
        const parsed = extractJsonFromAgentResult(agentResult.resultText);
        parseMode = parsed.parseMode;
        validationPayload = parsed.payload;
        if (parsed.parseMode !== "raw") {
          if (parsed.parseMode !== "json") {
            validationPayload = {
              ...validationPayload,
              _meta: {
                parseMode: parsed.parseMode,
                parseDiagnostics: parsed.parseDiagnostics,
                rawResultTextPreview: parsed.rawResultTextPreview,
              },
            };
          }
        }
      }

      const parseDurationMs = Date.now() - parseStartMs;
      console.log(
        `${LOG} jobId=${jobId} | parsed validation result | parseMode=${parseMode} durationMs=${parseDurationMs}`,
      );

      const validatedProductCount = extractValidationProductCount(validationPayload);

      if (validatedProductCount !== csvParseResult.productCount) {
        console.warn(
          `${LOG} jobId=${jobId} | agent validation returned invalid product count (${validatedProductCount ?? "none"}/${csvParseResult.productCount}) — using deterministic result`,
        );
        await storeDeterministicFallback(
          jobId,
          csvParseResult,
          preparseMs,
          jobStartMs,
          ctx,
          agentDurationMs,
          "invalid_agent_validation_product_count",
        );
        return;
      }

      // Insert raw extraction
      const insertStartMs = Date.now();
      try {
        await insertFileIqRawExtraction({
          id: randomUUID(),
          extractionJobId: jobId,
          sourceFileId: null,
          artifactType: "agent_result",
          storageUri: "inline:payload",
          payload: {
            ...csvParseResult.payload,
            _meta: {
              ...(typeof csvParseResult.payload._meta === "object" && csvParseResult.payload._meta !== null
                ? (csvParseResult.payload._meta as Record<string, unknown>)
                : {}),
              agentSessionId: agentResult.agentSessionId,
              numTurns: agentResult.numTurns,
              totalCostUsd: agentResult.totalCostUsd,
              agentStatus: agentResult.status,
              agentValidation: validationPayload,
              localPreparse: {
                parser: "rocktomic_inventory_csv",
                productsParsed: csvParseResult.productCount,
                confidence: csvParseResult.confidence,
              },
            },
          },
        });
      } catch (err) {
        console.error(
          `${LOG} jobId=${jobId} | raw extraction insert failed | error=${normalizeError(err)}`,
        );
      }
      const insertDurationMs = Date.now() - insertStartMs;

      // Update job
      const totalMs = Date.now() - jobStartMs;
      const totalProductsFound = csvParseResult.productCount;

      console.log(
        `${LOG} jobId=${jobId} | done (deterministic+agent) | totalProductsFound=${totalProductsFound} preparseMs=${preparseMs} agentDurationMs=${agentDurationMs} totalMs=${totalMs}`,
      );

      try {
        await updateFileIqExtractionJob(jobId, {
          status: "completed",
          agentSessionId: agentResult.agentSessionId,
          errorCode: null,
          errorMessage: null,
          summary: {
            totalProductsFound,
            agentStatus: agentResult.status,
            numTurns: agentResult.numTurns,
            agentOrchestration: true,
            localPreparse: {
              parser: "rocktomic_inventory_csv",
              productsParsed: csvParseResult.productCount,
              confidence: csvParseResult.confidence,
            },
            ...(catalogSummary !== null && {
              schemaType: catalogSummary.schemaType,
              schemaVersion: catalogSummary.schemaVersion,
            }),
            _timing: {
              preparseMs,
              agentDurationMs,
              parseDurationMs,
              insertDurationMs,
              totalMs,
              route: ctx.route,
            },
          },
        });
      } catch (err) {
        console.error(
          `${LOG} jobId=${jobId} | DB job update failed | error=${normalizeError(err)}`,
        );
      }
      return;
    }

    // Low confidence — fall through to standard agent path
    console.log(
      `${LOG} jobId=${jobId} | deterministic CSV low confidence — falling back to agent`,
    );
  }

  // ── Standard agent path ───────────────────────────────────────────────────
  const agentStartMs = Date.now();
  console.log(
    `${LOG} jobId=${jobId} | starting agent | schemaType=product_catalog route=${ctx.route ?? "agent_unstructured"} maxTurns=${effectiveAgentMaxTurns}`,
  );

  let agentResult;
  try {
    agentResult = await runFileIqExtractionAgent({
      jobId,
      bundleId,
      prompt: ctx.agentPrompt,
      cwd: ctx.cwd ?? undefined,
      additionalDirectories:
        ctx.additionalDirectories.length > 0 ? ctx.additionalDirectories : undefined,
      maxTurns: effectiveAgentMaxTurns,
    });
  } catch (err) {
    const msg = normalizeError(err);
    const totalMs = Date.now() - jobStartMs;
    console.error(
      `${LOG} jobId=${jobId} | agent threw | error=${msg} totalMs=${totalMs}`,
    );
    await updateFileIqExtractionJob(jobId, {
      status: "failed",
      agentSessionId: null,
      errorCode: "agent_exception",
      errorMessage: msg,
      summary: { _timing: { agentDurationMs: Date.now() - agentStartMs, totalMs } },
    }).catch((dbErr: unknown) => {
      console.error(
        `${LOG} jobId=${jobId} | DB update failed after agent throw | error=${normalizeError(dbErr)}`,
      );
    });
    return;
  }

  const agentDurationMs = Date.now() - agentStartMs;
  console.log(
    `${LOG} jobId=${jobId} | agent returned | status=${agentResult.status} numTurns=${agentResult.numTurns} totalCostUsd=${agentResult.totalCostUsd ?? "n/a"} durationMs=${agentDurationMs}`,
  );

  // ── Parse result ──────────────────────────────────────────────────────────
  const parseStartMs = Date.now();
  let extractedPayload: Record<string, unknown> = {};
  let catalogSummary: ReturnType<typeof detectProductCatalogSummary> = null;
  let parseMode = "none";

  if (agentResult.status === "completed" && agentResult.resultText) {
    const parsed = extractJsonFromAgentResult(agentResult.resultText);
    parseMode = parsed.parseMode;
    extractedPayload = parsed.payload;

    if (parsed.parseMode !== "raw") {
      if (parsed.parseMode !== "json") {
        extractedPayload = {
          ...extractedPayload,
          _meta: {
            parseMode: parsed.parseMode,
            parseDiagnostics: parsed.parseDiagnostics,
            rawResultTextPreview: parsed.rawResultTextPreview,
          },
        };
      }
      catalogSummary = detectProductCatalogSummary(extractedPayload);
    }
  }

  const parseDurationMs = Date.now() - parseStartMs;
  console.log(
    `${LOG} jobId=${jobId} | parsed result | parseMode=${parseMode} durationMs=${parseDurationMs}`,
  );

  // ── Insert raw extraction ─────────────────────────────────────────────────
  const insertStartMs = Date.now();
  try {
    await insertFileIqRawExtraction({
      id: randomUUID(),
      extractionJobId: jobId,
      sourceFileId: null,
      artifactType: "agent_result",
      storageUri: "inline:payload",
      payload: {
        ...extractedPayload,
        _meta: {
          ...(typeof (extractedPayload._meta) === "object" && extractedPayload._meta !== null
            ? (extractedPayload._meta as Record<string, unknown>)
            : {}),
          agentSessionId: agentResult.agentSessionId,
          numTurns: agentResult.numTurns,
          totalCostUsd: agentResult.totalCostUsd,
          agentStatus: agentResult.status,
        },
      },
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | raw extraction insert failed | error=${normalizeError(err)}`,
    );
  }
  const insertDurationMs = Date.now() - insertStartMs;
  console.log(
    `${LOG} jobId=${jobId} | inserted raw extraction | durationMs=${insertDurationMs}`,
  );

  // ── Update job ────────────────────────────────────────────────────────────
  const totalMs = Date.now() - jobStartMs;
  const dbStatus = agentResult.status === "completed" ? "completed" : "failed";
  const totalProductsFound =
    catalogSummary?.totalProductsFound ??
    (typeof extractedPayload.totalProductsFound === "number"
      ? extractedPayload.totalProductsFound
      : 0);

  console.log(
    `${LOG} jobId=${jobId} | done | status=${dbStatus} totalProductsFound=${totalProductsFound} totalMs=${totalMs}`,
  );

  try {
    await updateFileIqExtractionJob(jobId, {
      status: dbStatus,
      agentSessionId: agentResult.agentSessionId,
      errorCode: agentResult.errorCode,
      errorMessage: agentResult.errorMessage,
      summary: {
        totalProductsFound,
        agentStatus: agentResult.status,
        numTurns: agentResult.numTurns,
        ...(catalogSummary !== null && {
          schemaType: catalogSummary.schemaType,
          schemaVersion: catalogSummary.schemaVersion,
        }),
        _timing: {
          agentDurationMs,
          parseDurationMs,
          insertDurationMs,
          totalMs,
          route: ctx.route ?? "agent_unstructured",
        },
      },
    });
  } catch (err) {
    console.error(
      `${LOG} jobId=${jobId} | DB job update failed | status=${dbStatus} error=${normalizeError(err)}`,
    );
  }
}

async function runWorkerLoop(): Promise<void> {
  console.log(`${LOG} started | poll_interval_ms=${POLL_INTERVAL_MS}`);

  for (;;) {
    let job;
    try {
      job = await claimFileIqPendingJob();
    } catch (err) {
      console.error(`${LOG} poll error | error=${normalizeError(err)}`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const claimedMs = Date.now();
    console.log(`${LOG} claimed jobId=${job.id} bundleId=${job.bundleId}`);

    const ctx = extractWorkerContext(job.summary);
    if (!ctx) {
      console.error(
        `${LOG} jobId=${job.id} | missing _worker context in summary — marking failed`,
      );
      await updateFileIqExtractionJob(job.id, {
        status: "failed",
        agentSessionId: null,
        errorCode: "missing_worker_context",
        errorMessage:
          "Job summary is missing _worker.agentPrompt — job was created before worker support was added.",
        summary: {},
      }).catch((err: unknown) => {
        console.error(
          `${LOG} jobId=${job.id} | DB update failed | error=${normalizeError(err)}`,
        );
      });
      continue;
    }

    const waitMs = Date.now() - claimedMs;
    console.log(
      `${LOG} claimed jobId=${job.id} bundleId=${job.bundleId} waitMs=${waitMs}`,
    );

    await processFileIqJob(job.id, job.bundleId, ctx);
  }
}

async function main(): Promise<void> {
  await runWorkerLoop();
}

main().catch((err: unknown) => {
  console.error(`${LOG} fatal | error=${normalizeError(err)}`);
  process.exit(1);
});
