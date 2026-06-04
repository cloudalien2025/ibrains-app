import {
  createEcommercePool,
  getRequiredEcommerceDatabaseUrl,
  maskConnectionString,
} from "@/lib/ecommerce/database";
import { importRocktomicPackageToEcommerceDb } from "@/lib/ecommerce/rocktomic-import-runner";
import { loadRocktomicPackageArtifacts } from "@/lib/ecommerce/rocktomic-package-import";

async function assertRequiredTables(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ exists: string | null }> }> }): Promise<void> {
  const requiredTables = [
    "ecommerce_suppliers",
    "ecommerce_supplier_package_imports",
    "ecommerce_supplier_products",
    "ecommerce_supplier_product_facts",
    "ecommerce_supplier_pricing",
    "ecommerce_supplier_inventory",
    "ecommerce_supplier_assets",
    "ecommerce_supplier_validation_results",
  ];

  for (const table of requiredTables) {
    const result = await pool.query("SELECT to_regclass($1) AS exists", [table]);
    if (!result.rows[0]?.exists) {
      throw new Error(`Missing required table ${table}. Run npm run ecommerce:migrate first.`);
    }
  }
}

async function main(): Promise<void> {
  const connectionString = getRequiredEcommerceDatabaseUrl();
  const maskedTarget = maskConnectionString(connectionString);
  const pool = createEcommercePool(connectionString);

  try {
    await assertRequiredTables(pool as unknown as { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ exists: string | null }> }> });

    const { artifacts, artifactManifest } = await loadRocktomicPackageArtifacts(process.cwd());
    const sourceGitSha = process.env.SOURCE_GIT_SHA?.trim() || null;

    const { rowSet, packageImportId } = await importRocktomicPackageToEcommerceDb({
      pool,
      artifacts,
      artifactManifest,
      sourceGitSha,
    });

    console.log(`[ecomviper:import-rocktomic-supplier-package] target=${maskedTarget}`);
    console.log(`[ecomviper:import-rocktomic-supplier-package] import_id=${packageImportId}`);
    console.log(`[ecomviper:import-rocktomic-supplier-package] package_status=${rowSet.summary.packageStatus}`);
    console.log(
      `[ecomviper:import-rocktomic-supplier-package] skus=${rowSet.summary.totalSkus} usable=${rowSet.summary.usable} usable_with_warnings=${rowSet.summary.usableWithWarnings} blocked=${rowSet.summary.blocked} extraction_error=${rowSet.summary.extractionError}`
    );
    console.log(
      `[ecomviper:import-rocktomic-supplier-package] rows product_facts=${rowSet.summary.productFactsRows} pricing=${rowSet.summary.pricingRows} inventory=${rowSet.summary.inventoryRows} assets=${rowSet.summary.assetsRows} validation=${rowSet.summary.validationRows} skipped=${rowSet.summary.skippedRows} errored=${rowSet.summary.erroredRows}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ecomviper:import-rocktomic-supplier-package] failed: ${message}`);
    process.exitCode = 1;
  } finally {
    const endPool = (pool as unknown as { end?: () => Promise<void> }).end;
    if (typeof endPool === "function") {
      await endPool.call(pool).catch(() => undefined);
    }
  }
}

void main();
