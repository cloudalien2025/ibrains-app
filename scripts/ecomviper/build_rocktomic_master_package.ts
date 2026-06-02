import fs from "node:fs/promises";
import path from "node:path";
import {
  buildRocktomicMasterPackage,
  loadSourceBundleFromDir,
  type BuildMasterPackageOptions,
  type SourceBundle,
} from "@/lib/ecomviper/suppliers/rocktomic/master-package-builder";
import {
  validateMasterPackage,
} from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";
import { validateSourceIdentity } from "@/lib/ecomviper/suppliers/rocktomic/source-identity-validator";
import { getMissingDataSummary } from "@/lib/ecomviper/suppliers/rocktomic/master-package-reader";

const ROOT_DIR = process.cwd();
const ROCKTOMIC_DIR = path.join(ROOT_DIR, "data/ecomviper/suppliers/rocktomic");
const LATEST_DIR = path.join(ROCKTOMIC_DIR, "latest");
const SOURCES_PATH = path.join(ROCKTOMIC_DIR, "sources.json");

interface CliOptions {
  dryRun: boolean;
  live: boolean;
  sourceBundle: string | null;
  report: boolean;
  write: boolean;
  verbose: boolean;
  perSkuFiles: boolean;
  identityOnly: boolean;
}

function parseCli(argv: string[]): CliOptions {
  const has = (flag: string) => argv.includes(flag);
  const valueAfter = (flag: string): string | null => {
    const i = argv.findIndex((a) => a === flag);
    if (i < 0) return null;
    const next = argv[i + 1];
    return next && !next.startsWith("--") ? next : null;
  };

  return {
    dryRun: has("--dry-run"),
    live: has("--live"),
    sourceBundle: valueAfter("--source-bundle"),
    report: has("--report"),
    write: has("--write"),
    verbose: has("--verbose"),
    perSkuFiles: has("--per-sku-files"),
    identityOnly: has("--identity-only"),
  };
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

function printJson(label: string, obj: unknown): void {
  print(`${label}: ${JSON.stringify(obj, null, 2)}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

import type { RocktomicProductRecord } from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

async function buildAuditCsv(products: RocktomicProductRecord[]): Promise<string> {
  const header = "sku,productName,supplementFactsStatus,inventoryStatus,coaStatus,msrp,wholesaleCost,missingFields,warningCount";
  const rows = products.map((p) => {
    const missingFields = Object.entries(p.missingData)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join("|");
    const escape = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return [
      p.sku,
      escape(p.productName ?? ""),
      p.supplementFacts.status,
      p.inventory.status,
      p.coaUrl ? "available" : "missing",
      p.pricing.msrp?.toString() ?? "",
      p.pricing.wholesaleCost?.toString() ?? "",
      escape(missingFields),
      String(p.warnings.length),
    ].join(",");
  });
  return `${header}\n${rows.join("\n")}\n`;
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));

  print("[rocktomic:master-package] starting");

  const manifestText = await fs.readFile(SOURCES_PATH, "utf8");
  const manifest = JSON.parse(manifestText) as { sources: Array<{ id: string; name: string; url: string; type: string }>; sourceManifestVersion?: number; version?: number };

  const identityReport = validateSourceIdentity({
    sources: manifest.sources,
    manifestVersion: manifest.sourceManifestVersion ?? manifest.version ?? 1,
  });

  print(`source_identity_valid=${identityReport.overallValid}`);
  print(`duplicate_url_warnings=${identityReport.duplicateUrlWarnings.length}`);
  print(`duplicate_sheet_id_warnings=${identityReport.duplicateSheetIdWarnings.length}`);
  print(`mislabel_warnings=${identityReport.mislabelWarnings.length}`);

  if (!identityReport.overallValid) {
    print("[WARN] Source identity issues detected:");
    for (const w of identityReport.duplicateUrlWarnings) {
      print(`  [WARN] duplicate_url: "${w.url}" assigned to: ${w.assignedLabels.join(", ")}`);
    }
    for (const w of identityReport.duplicateSheetIdWarnings) {
      print(`  [WARN] duplicate_sheet_id: "${w.sheetId}" assigned to: ${w.assignedLabels.join(", ")}`);
    }
    for (const w of identityReport.mislabelWarnings) {
      print(`  [WARN] mislabel: id=${w.id} label="${w.assignedLabel}" detectedType=${w.detectedType}: ${w.details}`);
    }
  }

  if (options.identityOnly) {
    if (options.verbose) printJson("identity_report", identityReport);
    if (options.write && !options.dryRun) {
      await writeJson(path.join(LATEST_DIR, "source-identity-report.json"), identityReport);
      print(`write: source-identity-report.json -> ${LATEST_DIR}`);
    }
    return;
  }

  const bundlePath = options.sourceBundle ?? LATEST_DIR;
  let sourceBundle: SourceBundle;

  try {
    sourceBundle = await loadSourceBundleFromDir(bundlePath);
    print(`source_bundle_id=${sourceBundle.sourceBundleId}`);
    print(`source_bundle_dir=${bundlePath}`);
    print(`has_plds_csv=${Boolean(sourceBundle.pldsCsv)}`);
    print(`has_msrp_csv=${Boolean(sourceBundle.msrpCsv)}`);
    print(`has_inventory_csv=${Boolean(sourceBundle.inventoryCsv)}`);
    print(`has_templates_html=${Boolean(sourceBundle.templatesHtml)}`);
    print(`has_policy_docx=${Boolean(sourceBundle.policyDocxBuffer)}`);
    print(`has_existing_source_facts=${sourceBundle.existingSourceFacts !== null && sourceBundle.existingSourceFacts !== undefined ? (sourceBundle.existingSourceFacts?.length ?? 0) : 0}`);
    print(`has_existing_pricing=${sourceBundle.existingPricing !== null ? (sourceBundle.existingPricing?.length ?? 0) : 0}`);
    print(`has_existing_inventory=${sourceBundle.existingInventory !== null ? (sourceBundle.existingInventory?.length ?? 0) : 0}`);
    print(`has_existing_assets=${sourceBundle.existingAssets !== null ? (sourceBundle.existingAssets?.length ?? 0) : 0}`);
  } catch (error) {
    print(`[ERROR] Failed to load source bundle from ${bundlePath}: ${error instanceof Error ? error.message : String(error)}`);
    print("[INFO] Run with --source-bundle <path> or ensure latest/ contains sources.json");
    process.exitCode = 1;
    return;
  }

  const buildOptions: BuildMasterPackageOptions = {
    sourceBundle,
    dryRun: options.dryRun,
    allowLiveTemplates: options.live,
  };

  print("[rocktomic:master-package] building master package...");
  const masterPackage = await buildRocktomicMasterPackage(buildOptions);
  print(`product_count=${masterPackage.productCount}`);

  const validationReport = validateMasterPackage(masterPackage);
  print(`validation_package_status=${validationReport.packageStatus}`);
  print(`validation_valid=${validationReport.validProductCount}`);
  print(`validation_warning=${validationReport.warningProductCount}`);
  print(`validation_invalid=${validationReport.invalidProductCount}`);
  print(`supplement_facts_structured=${validationReport.supplementFactsCounts.structured}`);
  print(`supplement_facts_partial=${validationReport.supplementFactsCounts.partial}`);
  print(`supplement_facts_visual_only=${validationReport.supplementFactsCounts.visual_only}`);
  print(`supplement_facts_missing=${validationReport.supplementFactsCounts.missing}`);
  print(`supplement_facts_not_applicable=${validationReport.supplementFactsCounts.not_applicable}`);

  const missingSummary = getMissingDataSummary(masterPackage);
  print(`missing_productName=${missingSummary.missingProductName}`);
  print(`missing_pricing=${missingSummary.missingPricing}`);
  print(`missing_inventory=${missingSummary.missingInventory}`);
  print(`missing_coaUrl=${missingSummary.missingCoaUrl}`);
  print(`missing_supplementFacts=${missingSummary.missingSupplementFacts}`);

  print(`source_identity_valid=${masterPackage.sourceIdentityReport.overallValid}`);
  print(`source_duplicate_url_count=${masterPackage.sourceIdentityReport.duplicateUrlCount}`);
  print(`source_duplicate_sheet_id_count=${masterPackage.sourceIdentityReport.duplicateSheetIdCount}`);
  print(`source_mislabel_count=${masterPackage.sourceIdentityReport.mislabelCount}`);

  if (options.verbose) {
    printJson("counts_by_category", masterPackage.countsByCategory);
    printJson("counts_by_inventory_status", masterPackage.countsByInventoryStatus);
    printJson("counts_by_supplement_facts_status", masterPackage.countsBySupplementFactsStatus);
    printJson("counts_by_missing_data_type", masterPackage.countsByMissingDataType);
    printJson("identity_report", identityReport);
  }

  if (options.dryRun || !options.write) {
    print("write: skipped (dry-run mode; use --write to write outputs)");
    return;
  }

  print(`[rocktomic:master-package] writing outputs to ${LATEST_DIR}...`);

  await writeJson(path.join(LATEST_DIR, "rocktomic-supplier-package.json"), masterPackage);
  print("write: rocktomic-supplier-package.json");

  await writeJson(path.join(LATEST_DIR, "source-identity-report.json"), identityReport);
  print("write: source-identity-report.json");

  await writeJson(path.join(LATEST_DIR, "validation-report-master.json"), validationReport);
  print("write: validation-report-master.json");

  const auditCsv = await buildAuditCsv(masterPackage.products);
  await fs.writeFile(path.join(LATEST_DIR, "audit-master.csv"), auditCsv, "utf8");
  print("write: audit-master.csv");

  if (options.perSkuFiles) {
    const skuDir = path.join(LATEST_DIR, "skus");
    await fs.mkdir(skuDir, { recursive: true });
    for (const product of masterPackage.products) {
      await writeJson(path.join(skuDir, `${product.sku}.json`), product);
    }
    print(`write: skus/*.json (${masterPackage.products.length} files)`);
  }

  print("[rocktomic:master-package] done");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  process.stderr.write(`[rocktomic:master-package] FATAL: ${message}\n`);
  process.exitCode = 1;
});
