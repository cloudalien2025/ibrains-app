import fs from "node:fs/promises";
import path from "node:path";
import {
  buildRocktomicSupplierIntelligence,
  loadRocktomicSourceManifest,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-supplier-intelligence";
import {
  toSupplierIntelligenceAuditCsv,
  validateSupplierIntelligencePackage,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-validation";

interface CliOptions {
  dryRun: boolean;
  fixtures: boolean;
  sku: string | null;
  all: boolean;
  useFirecrawl: boolean;
  useCache: boolean;
  noWrite: boolean;
  writePackage: boolean;
  reportOnly: boolean;
  verbose: boolean;
  debugSnippet: boolean;
}

const ROOT_DIR = process.cwd();
const ROCKTOMIC_DIR = path.join(ROOT_DIR, "data/ecomviper/suppliers/rocktomic");
const SOURCES_PATH = path.join(ROCKTOMIC_DIR, "sources.json");
const CANDIDATES_DIR = path.join(ROCKTOMIC_DIR, "candidates");

function parseCli(argv: string[]): CliOptions {
  const has = (flag: string) => argv.includes(flag);
  const valueAfter = (flag: string): string | null => {
    const index = argv.findIndex((entry) => entry === flag);
    if (index < 0) return null;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) return null;
    return next;
  };

  return {
    dryRun: has("--dry-run"),
    fixtures: has("--fixtures"),
    sku: valueAfter("--sku"),
    all: has("--all"),
    useFirecrawl: has("--use-firecrawl"),
    useCache: has("--cache"),
    noWrite: has("--no-write"),
    writePackage: has("--write-package"),
    reportOnly: has("--report-only"),
    verbose: has("--verbose"),
    debugSnippet: has("--debug-snippet"),
  };
}

function usage(): string {
  return [
    "Usage: npx tsx scripts/ecomviper/build_rocktomic_supplier_intelligence.ts [options]",
    "  --dry-run",
    "  --fixtures",
    "  --sku <SKU>",
    "  --all",
    "  --use-firecrawl",
    "  --cache",
    "  --no-write",
    "  --write-package",
    "  --report-only",
    "  --verbose",
    "  --debug-snippet",
  ].join("\n");
}

function timestampId(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

async function writeJson(absolutePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));

  if (!options.sku && !options.all) {
    throw new Error(`Either --sku <SKU> or --all is required.\n${usage()}`);
  }

  if (options.writePackage && options.noWrite) {
    throw new Error("--write-package cannot be used with --no-write");
  }

  const manifest = await loadRocktomicSourceManifest(SOURCES_PATH);

  const skuFilter = options.all ? null : [options.sku as string];
  const result = await buildRocktomicSupplierIntelligence({
    manifest,
    skuFilter,
    useFixtures: options.fixtures || !options.useFirecrawl,
    useFirecrawl: options.useFirecrawl,
    useCache: options.useCache,
  });

  const validation = validateSupplierIntelligencePackage(result.package);
  const auditCsv = toSupplierIntelligenceAuditCsv(validation);

  const summary = {
    mode: {
      dryRun: options.dryRun,
      fixtures: options.fixtures || !options.useFirecrawl,
      useFirecrawl: options.useFirecrawl,
      cache: options.useCache,
      writePackage: options.writePackage,
      reportOnly: options.reportOnly,
    },
    sourceOrigin: result.sourceOrigin,
    firecrawlSource: result.firecrawlSource,
    reason: result.reason || "ok",
    selectedSku: options.sku,
    records: result.package.records.length,
    recordsExtracted: result.package.records.length,
    structuredSupplementFactsCount: validation.structuredSupplementFactsCount,
    partialCount: validation.partialCount,
    imageTextOnlyCount: validation.imageTextOnlyCount,
    missingSupplementFactsCount: validation.missingSupplementFactsCount,
    needsReviewCount: validation.needsReviewCount,
    parserWarningsCount: validation.parserWarningsCount,
    provenanceMissingCount: validation.provenanceMissingCount,
    linkExtractionMissingCount: validation.linkExtractionMissingCount,
    supplementFactsIncompleteCount: validation.supplementFactsIncompleteCount,
    logs: result.logs,
  };

  print(`rocktomic_supplier_intelligence source=${result.sourceOrigin}`);
  print(`firecrawl_source=${result.firecrawlSource}`);
  print(`records_extracted=${result.package.records.length}`);
  if (options.sku) print(`selected_sku=${options.sku}`);
  if (result.package.records.length === 0 && result.reason) print(`reason=${result.reason}`);
  for (const line of result.logs) print(`log: ${line}`);
  if (result.package.records.length === 1) {
    const record = result.package.records[0];
    print(`sku=${record.sku}`);
    print(`productName=${record.productName || "unknown"}`);
    print(`sourceStatus=${record.sourceStatus}`);
    print(`missingFields=${record.missingFields.join("|") || "none"}`);
    print(`extractionWarnings=${(record.extractionWarnings || []).join("|") || "none"}`);
    print(
      `provenance=${record.provenance.map((entry) => `${entry.sourceType}@${entry.sourceUrl}`).slice(0, 3).join(";") || "none"}`
    );
    if (options.debugSnippet) {
      print(
        `debug_snippet=${record.provenance.map((entry) => entry.rawSnippet).filter(Boolean).slice(0, 1).join(" ").slice(0, 900)}`
      );
    }
  }
  if (options.verbose) {
    print(`validation: ${JSON.stringify(validation)}`);
  }
  print(`summary: ${JSON.stringify(summary)}`);

  const shouldWrite = !options.dryRun && !options.noWrite && (options.writePackage || !options.reportOnly);
  if (!shouldWrite) {
    print("write: skipped (dry-run/no-write/report-only)");
    return;
  }

  const candidateDir = path.join(CANDIDATES_DIR, timestampId());
  await fs.mkdir(candidateDir, { recursive: true });

  await writeJson(path.join(candidateDir, "sourceFacts.json"), result.package);
  await writeJson(path.join(candidateDir, "assets.json"), result.assets);
  await writeJson(path.join(candidateDir, "pricing.json"), result.pricing);
  await writeJson(path.join(candidateDir, "inventory.json"), result.inventory);
  await writeJson(path.join(candidateDir, "validation-report.json"), validation);
  await fs.writeFile(path.join(candidateDir, "audit.csv"), auditCsv, "utf8");

  print(`write: candidate=${candidateDir}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  process.stderr.write(`[rocktomic-supplier-intelligence] ${message}\n`);
  process.exitCode = 1;
});
