import fs from "node:fs/promises";
import path from "node:path";
import {
  createEcommercePool,
  getRequiredEcommerceDatabaseUrl,
  maskConnectionString,
} from "@/lib/ecommerce/database";

interface ValidationReport {
  totalSkusValidated?: number;
  usableSkuCount?: number;
  usableWithWarningsSkuCount?: number;
  blockedSkuCount?: number;
  extractionErrorSkuCount?: number;
  ingredientMatchingReadyCount?: number;
  ingredientMatchingReadyWithWarningsCount?: number;
  ingredientMatchingBlockedCount?: number;
  productEditorFactsReadyCount?: number;
  productEditorFactsReadyWithWarningsCount?: number;
  productEditorFactsBlockedCount?: number;
  missingCoaWarningCount?: number;
  missingCoaNoLongerGlobalBlockCount?: number;
}

async function loadValidationReport(rootDir: string): Promise<ValidationReport> {
  const filePath = path.join(rootDir, "data/ecomviper/suppliers/rocktomic/latest/validation-report.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as ValidationReport;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function main(): Promise<void> {
  const connectionString = getRequiredEcommerceDatabaseUrl();
  const maskedTarget = maskConnectionString(connectionString);
  const pool = createEcommercePool(connectionString);
  const supplierSlug = "rocktomic";

  try {
    const report = await loadValidationReport(process.cwd());

    const supplierCheck = await pool.query<{ supplier_slug: string }>(
      "SELECT supplier_slug FROM ecommerce_suppliers WHERE supplier_slug = $1 LIMIT 1",
      [supplierSlug]
    );
    if (supplierCheck.rows.length === 0) {
      throw new Error("Rocktomic supplier row is missing in ecommerce_suppliers");
    }

    const productCountRows = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM ecommerce_supplier_products WHERE supplier_slug = $1",
      [supplierSlug]
    );
    const productCount = Number.parseInt(productCountRows.rows[0]?.count || "0", 10);

    const statusRows = await pool.query<{ validation_status: string; count: string }>(
      `SELECT validation_status, COUNT(*)::text AS count
         FROM ecommerce_supplier_products
        WHERE supplier_slug = $1
        GROUP BY validation_status`,
      [supplierSlug]
    );
    const statusCounts = new Map(statusRows.rows.map((row) => [row.validation_status, Number.parseInt(row.count, 10)]));

    const expected = {
      total: asNumber(report.totalSkusValidated),
      usable: asNumber(report.usableSkuCount),
      usableWithWarnings: asNumber(report.usableWithWarningsSkuCount),
      blocked: asNumber(report.blockedSkuCount),
      extractionError: asNumber(report.extractionErrorSkuCount),
    };

    const actual = {
      total: productCount,
      usable: statusCounts.get("usable") || 0,
      usableWithWarnings: statusCounts.get("usable_with_warnings") || 0,
      blocked: statusCounts.get("blocked") || 0,
      extractionError: statusCounts.get("extraction_error") || 0,
    };

    const tableCountsRows = await pool.query<{ table_name: string; count: string }>(
      `SELECT 'facts'::text AS table_name, COUNT(*)::text AS count FROM ecommerce_supplier_product_facts WHERE supplier_slug = $1
       UNION ALL
       SELECT 'pricing'::text AS table_name, COUNT(*)::text AS count FROM ecommerce_supplier_pricing WHERE supplier_slug = $1
       UNION ALL
       SELECT 'inventory'::text AS table_name, COUNT(*)::text AS count FROM ecommerce_supplier_inventory WHERE supplier_slug = $1
       UNION ALL
       SELECT 'assets'::text AS table_name, COUNT(*)::text AS count FROM ecommerce_supplier_assets WHERE supplier_slug = $1
       UNION ALL
       SELECT 'validation'::text AS table_name, COUNT(*)::text AS count FROM ecommerce_supplier_validation_results WHERE supplier_slug = $1`,
      [supplierSlug]
    );

    const readinessRows = await pool.query<{ readiness: string; count: string }>(
      `SELECT readiness->>'ingredientMatchingReadiness' AS readiness, COUNT(*)::text AS count
         FROM ecommerce_supplier_validation_results
        WHERE supplier_slug = $1
        GROUP BY readiness->>'ingredientMatchingReadiness'`,
      [supplierSlug]
    );
    const ingredientReadiness = new Map(readinessRows.rows.map((row) => [row.readiness || "unknown", Number.parseInt(row.count, 10)]));

    const productEditorRows = await pool.query<{ readiness: string; count: string }>(
      `SELECT readiness->>'productEditorFactsReadiness' AS readiness, COUNT(*)::text AS count
         FROM ecommerce_supplier_validation_results
        WHERE supplier_slug = $1
        GROUP BY readiness->>'productEditorFactsReadiness'`,
      [supplierSlug]
    );
    const productEditorReadiness = new Map(productEditorRows.rows.map((row) => [row.readiness || "unknown", Number.parseInt(row.count, 10)]));

    const coaVsIngredient = await pool.query<{ missing_coa_warning: string; ingredient_blocked: string; ingredient_ready: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE warning_defects::text ILIKE '%assets.coaUrl%')::text AS missing_coa_warning,
         COUNT(*) FILTER (WHERE readiness->>'ingredientMatchingReadiness' = 'blocked' AND warning_defects::text ILIKE '%assets.coaUrl%')::text AS ingredient_blocked,
         COUNT(*) FILTER (WHERE readiness->>'ingredientMatchingReadiness' IN ('ready','ready_with_warnings','needs_review') AND warning_defects::text ILIKE '%assets.coaUrl%')::text AS ingredient_ready
       FROM ecommerce_supplier_validation_results
       WHERE supplier_slug = $1`,
      [supplierSlug]
    );

    const extraCoverage = await pool.query<{ ai_count: string; ocr_count: string; ready_for_optipixel: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE ai_label_text_evidence <> '{}'::jsonb)::text AS ai_count,
         COUNT(*) FILTER (WHERE ocr_evidence <> '{}'::jsonb)::text AS ocr_count,
         COUNT(*) FILTER (WHERE ready_for_optipixel = true)::text AS ready_for_optipixel
       FROM ecommerce_supplier_assets
       WHERE supplier_slug = $1`,
      [supplierSlug]
    );

    const mismatches: string[] = [];
    if (expected.total !== actual.total) mismatches.push(`totalSkusValidated mismatch expected=${expected.total} actual=${actual.total}`);
    if (expected.usable !== actual.usable) mismatches.push(`usableSkuCount mismatch expected=${expected.usable} actual=${actual.usable}`);
    if (expected.usableWithWarnings !== actual.usableWithWarnings) {
      mismatches.push(`usableWithWarningsSkuCount mismatch expected=${expected.usableWithWarnings} actual=${actual.usableWithWarnings}`);
    }
    if (expected.blocked !== actual.blocked) mismatches.push(`blockedSkuCount mismatch expected=${expected.blocked} actual=${actual.blocked}`);
    if (expected.extractionError !== actual.extractionError) {
      mismatches.push(`extractionErrorSkuCount mismatch expected=${expected.extractionError} actual=${actual.extractionError}`);
    }

    if (actual.blocked === 0 && expected.blocked > 0) {
      mismatches.push("blocked SKUs were expected but none were found in DB");
    }

    const expectedIngredientReady =
      asNumber(report.ingredientMatchingReadyCount) + asNumber(report.ingredientMatchingReadyWithWarningsCount);
    const actualIngredientReady =
      (ingredientReadiness.get("ready") || 0) +
      (ingredientReadiness.get("ready_with_warnings") || 0) +
      (ingredientReadiness.get("needs_review") || 0);
    if (expectedIngredientReady !== actualIngredientReady) {
      mismatches.push(`ingredientMatching readiness mismatch expected=${expectedIngredientReady} actual=${actualIngredientReady}`);
    }
    if (asNumber(report.ingredientMatchingBlockedCount) !== (ingredientReadiness.get("blocked") || 0)) {
      mismatches.push(
        `ingredientMatching blocked mismatch expected=${asNumber(report.ingredientMatchingBlockedCount)} actual=${ingredientReadiness.get("blocked") || 0}`
      );
    }

    const expectedProductEditorReady =
      asNumber(report.productEditorFactsReadyCount) + asNumber(report.productEditorFactsReadyWithWarningsCount);
    const actualProductEditorReady =
      (productEditorReadiness.get("ready") || 0) +
      (productEditorReadiness.get("ready_with_warnings") || 0) +
      (productEditorReadiness.get("needs_review") || 0);
    if (expectedProductEditorReady !== actualProductEditorReady) {
      mismatches.push(`productEditorFacts readiness mismatch expected=${expectedProductEditorReady} actual=${actualProductEditorReady}`);
    }
    if (asNumber(report.productEditorFactsBlockedCount) !== (productEditorReadiness.get("blocked") || 0)) {
      mismatches.push(
        `productEditorFacts blocked mismatch expected=${asNumber(report.productEditorFactsBlockedCount)} actual=${productEditorReadiness.get("blocked") || 0}`
      );
    }
    if (asNumber(report.missingCoaNoLongerGlobalBlockCount) > 0 && Number.parseInt(coaVsIngredient.rows[0]?.ingredient_ready || "0", 10) === 0) {
      mismatches.push("missing COA appears to block ingredient matching unexpectedly (no ready rows with missing_coa warning)");
    }

    console.log(`[ecommerce:verify-rocktomic-import] target=${maskedTarget}`);
    console.log(`[ecommerce:verify-rocktomic-import] supplier=${supplierSlug}`);
    console.log(
      `[ecommerce:verify-rocktomic-import] expected total=${expected.total} usable=${expected.usable} usable_with_warnings=${expected.usableWithWarnings} blocked=${expected.blocked} extraction_error=${expected.extractionError}`
    );
    console.log(
      `[ecommerce:verify-rocktomic-import] actual   total=${actual.total} usable=${actual.usable} usable_with_warnings=${actual.usableWithWarnings} blocked=${actual.blocked} extraction_error=${actual.extractionError}`
    );

    const tableCountsSummary = tableCountsRows.rows.map((row) => `${row.table_name}=${row.count}`).join(" ");
    console.log(`[ecommerce:verify-rocktomic-import] table_counts ${tableCountsSummary}`);

    const coverageRow = extraCoverage.rows[0];
    console.log(
      `[ecommerce:verify-rocktomic-import] coverage ai_label_text_evidence=${coverageRow?.ai_count || "0"} ocr_evidence=${coverageRow?.ocr_count || "0"} ready_for_optipixel=${coverageRow?.ready_for_optipixel || "0"}`
    );
    console.log(
      `[ecommerce:verify-rocktomic-import] readiness ingredient_matching ready=${actualIngredientReady} blocked=${ingredientReadiness.get("blocked") || 0}`
    );
    console.log(
      `[ecommerce:verify-rocktomic-import] readiness product_editor_facts ready=${actualProductEditorReady} blocked=${productEditorReadiness.get("blocked") || 0}`
    );
    const coaRow = coaVsIngredient.rows[0];
    console.log(
      `[ecommerce:verify-rocktomic-import] missing_coa warning_check missing_coa_warning=${coaRow?.missing_coa_warning || "0"} ingredient_blocked_with_coa_warning=${coaRow?.ingredient_blocked || "0"} ingredient_ready_with_coa_warning=${coaRow?.ingredient_ready || "0"}`
    );

    if (mismatches.length > 0) {
      for (const mismatch of mismatches) {
        console.error(`[ecommerce:verify-rocktomic-import] mismatch: ${mismatch}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log("[ecommerce:verify-rocktomic-import] verification passed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ecommerce:verify-rocktomic-import] failed: ${message}`);
    process.exitCode = 1;
  } finally {
    const endPool = (pool as unknown as { end?: () => Promise<void> }).end;
    if (typeof endPool === "function") {
      await endPool.call(pool).catch(() => undefined);
    }
  }
}

void main();
