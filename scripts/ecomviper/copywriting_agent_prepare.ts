import fs from "node:fs/promises";
import path from "node:path";
import {
  applySelectionFilters,
  buildInputsFromFixtures,
  loadAllRocktomicProductInputs,
  loadGoldenFixtures,
  type PreparedCopywritingInputRecord,
} from "../../lib/ecomviper/copywriting-agent/copywriting-agent-data";

interface PrepareCliOptions {
  all: boolean;
  fixtures: boolean;
  sku: string | null;
  handle: string | null;
  limit: number | null;
  dryRun: boolean;
}

interface PrepareSummary {
  selectedCount: number;
  mode: "fixtures" | "all" | "mixed";
  dryRun: boolean;
  filters: {
    sku: string | null;
    handle: string | null;
    limit: number | null;
  };
  missingDataCounts: {
    coaMissing: number;
    pricingMissing: number;
    inventoryMissing: number;
    supplementFactsMissing: number;
    supplierMatchMissing: number;
  };
}

function parseArgs(argv: string[]): PrepareCliOptions {
  const options: PrepareCliOptions = {
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
    options.all = true;
  }

  return options;
}

function buildSummary(records: PreparedCopywritingInputRecord[], options: PrepareCliOptions, mode: PrepareSummary["mode"]): PrepareSummary {
  const counts = {
    coaMissing: 0,
    pricingMissing: 0,
    inventoryMissing: 0,
    supplementFactsMissing: 0,
    supplierMatchMissing: 0,
  };

  for (const record of records) {
    if (record.input.missingData.coaMissing) counts.coaMissing += 1;
    if (record.input.missingData.pricingMissing) counts.pricingMissing += 1;
    if (record.input.missingData.inventoryMissing) counts.inventoryMissing += 1;
    if (record.input.missingData.supplementFactsMissing) counts.supplementFactsMissing += 1;
    if (record.input.missingData.supplierMatchMissing) counts.supplierMatchMissing += 1;
  }

  return {
    selectedCount: records.length,
    mode,
    dryRun: options.dryRun,
    filters: {
      sku: options.sku,
      handle: options.handle,
      limit: options.limit,
    },
    missingDataCounts: counts,
  };
}

export async function runCopywritingAgentPrepare(options: PrepareCliOptions, repoRoot = process.cwd()): Promise<{
  summary: PrepareSummary;
  records: PreparedCopywritingInputRecord[];
}> {
  const sources: PreparedCopywritingInputRecord[] = [];

  if (options.fixtures) {
    const fixtures = await loadGoldenFixtures(repoRoot);
    sources.push(...buildInputsFromFixtures(fixtures));
  }

  if (options.all) {
    sources.push(...(await loadAllRocktomicProductInputs(repoRoot)));
  }

  const filtered = applySelectionFilters(sources, {
    sku: options.sku,
    handle: options.handle,
    limit: options.limit,
  });

  const mode: PrepareSummary["mode"] = options.fixtures && options.all ? "mixed" : options.fixtures ? "fixtures" : "all";
  const summary = buildSummary(filtered, options, mode);

  const latestDir = path.join(repoRoot, "data/ecomviper/copywriting-agent/latest");
  if (!options.dryRun) {
    await fs.mkdir(latestDir, { recursive: true });
    await fs.writeFile(
      path.join(latestDir, "prepared-inputs.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), records: filtered }, null, 2),
      "utf8"
    );
    await fs.writeFile(path.join(latestDir, "prepare-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  }

  return { summary, records: filtered };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { summary } = await runCopywritingAgentPrepare(options);
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error) => {
    console.error(`[copywriting-agent-prepare] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
