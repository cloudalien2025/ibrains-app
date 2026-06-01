import fs from "node:fs/promises";
import path from "node:path";
import {
  applySelectionFilters,
  buildInputsFromFixtures,
  loadAllRocktomicProductInputs,
  loadGoldenFixtures,
  type PreparedCopywritingInputRecord,
} from "../../lib/ecomviper/copywriting-agent/copywriting-agent-data";
import { evaluateProductCopywritingOutput, type ProductCopywritingEvalResult } from "../../lib/ecomviper/copywriting-agent/copywriting-agent-evals";

interface EvaluateCliOptions {
  all: boolean;
  fixtures: boolean;
  sku: string | null;
  handle: string | null;
  limit: number | null;
  dryRun: boolean;
}

interface EvalReportRow {
  id: string;
  mode: string;
  hasOutput: boolean;
  eval: ProductCopywritingEvalResult | null;
  notes: string[];
}

interface EvalReport {
  generatedAt: string;
  mode: "fixtures" | "all" | "mixed";
  filters: {
    sku: string | null;
    handle: string | null;
    limit: number | null;
  };
  totals: {
    selected: number;
    evaluated: number;
    passed: number;
    failed: number;
    missingOutput: number;
  };
  rows: EvalReportRow[];
}

function parseArgs(argv: string[]): EvaluateCliOptions {
  const options: EvaluateCliOptions = {
    all: false,
    fixtures: false,
    sku: null,
    handle: null,
    limit: null,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--all") options.all = true;
    else if (arg === "--fixtures") options.fixtures = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--sku" && next) {
      options.sku = next.trim();
      index += 1;
    } else if (arg === "--handle" && next) {
      options.handle = next.trim();
      index += 1;
    } else if (arg === "--limit" && next) {
      const parsed = Number.parseInt(next, 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    }
  }

  if (!options.all && !options.fixtures) {
    options.fixtures = true;
  }

  return options;
}

async function loadPreparedInputs(repoRoot: string): Promise<PreparedCopywritingInputRecord[]> {
  const preparedPath = path.join(repoRoot, "data/ecomviper/copywriting-agent/latest/prepared-inputs.json");
  try {
    const text = await fs.readFile(preparedPath, "utf8");
    const parsed = JSON.parse(text) as { records?: PreparedCopywritingInputRecord[] };
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(report: EvalReport): string {
  const header = [
    "id",
    "mode",
    "hasOutput",
    "passed",
    "schemaValidity",
    "factualGrounding",
    "supplementCompliance",
    "agenticVisibility",
    "conversionQuality",
    "missingDataBehavior",
    "brandVoice",
    "sourceUseTransparency",
    "hardFailures",
    "warnings",
  ];

  const lines = [header.join(",")];
  for (const row of report.rows) {
    const evalRow = row.eval;
    lines.push(
      [
        row.id,
        row.mode,
        String(row.hasOutput),
        String(evalRow?.passed ?? false),
        String(evalRow?.schemaValidity ?? 0),
        String(evalRow?.factualGrounding ?? 0),
        String(evalRow?.supplementCompliance ?? 0),
        String(evalRow?.agenticVisibility ?? 0),
        String(evalRow?.conversionQuality ?? 0),
        String(evalRow?.missingDataBehavior ?? 0),
        String(evalRow?.brandVoice ?? 0),
        String(evalRow?.sourceUseTransparency ?? 0),
        escapeCsv((evalRow?.hardFailures || []).join(" | ")),
        escapeCsv((evalRow?.warnings || row.notes).join(" | ")),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export async function runCopywritingAgentEvaluate(options: EvaluateCliOptions, repoRoot = process.cwd()): Promise<EvalReport> {
  const records: PreparedCopywritingInputRecord[] = [];

  if (options.fixtures) {
    const fixtures = await loadGoldenFixtures(repoRoot);
    records.push(...buildInputsFromFixtures(fixtures));
  }

  if (options.all) {
    const fromPrepared = await loadPreparedInputs(repoRoot);
    if (fromPrepared.length > 0) {
      records.push(...fromPrepared);
    } else {
      records.push(...(await loadAllRocktomicProductInputs(repoRoot)));
    }
  }

  const filtered = applySelectionFilters(records, {
    sku: options.sku,
    handle: options.handle,
    limit: options.limit,
  });

  const rows: EvalReportRow[] = filtered.map((record) => {
    if (typeof record.expectedOutput === "undefined") {
      return {
        id: record.id,
        mode: record.mode,
        hasOutput: false,
        eval: null,
        notes: ["no output artifact provided for evaluation"],
      };
    }

    return {
      id: record.id,
      mode: record.mode,
      hasOutput: true,
      eval: evaluateProductCopywritingOutput(record.input, record.expectedOutput),
      notes: [],
    };
  });

  const evaluated = rows.filter((row) => row.eval !== null);
  const passed = evaluated.filter((row) => row.eval?.passed).length;

  const mode: EvalReport["mode"] = options.fixtures && options.all ? "mixed" : options.fixtures ? "fixtures" : "all";

  const report: EvalReport = {
    generatedAt: new Date().toISOString(),
    mode,
    filters: {
      sku: options.sku,
      handle: options.handle,
      limit: options.limit,
    },
    totals: {
      selected: rows.length,
      evaluated: evaluated.length,
      passed,
      failed: evaluated.length - passed,
      missingOutput: rows.length - evaluated.length,
    },
    rows,
  };

  if (!options.dryRun) {
    const latestDir = path.join(repoRoot, "data/ecomviper/copywriting-agent/latest");
    await fs.mkdir(latestDir, { recursive: true });
    await fs.writeFile(path.join(latestDir, "eval-report.json"), JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(path.join(latestDir, "eval-summary.csv"), toCsv(report), "utf8");
  }

  return report;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runCopywritingAgentEvaluate(options);
  console.log(JSON.stringify(report.totals, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error) => {
    console.error(`[copywriting-agent-evaluate] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
