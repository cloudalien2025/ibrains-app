import type { Pool } from "pg";
import { mapRocktomicPackageToEcommerceRows, type EcomImportRowSet, type JsonValue, type RocktomicPackageArtifacts } from "@/lib/ecommerce/rocktomic-package-import";

function asJsonb(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function upsertSupplier(pool: Pick<Pool, "query">, rowSet: EcomImportRowSet): Promise<void> {
  const row = rowSet.supplier;
  await pool.query(
    `INSERT INTO ecommerce_suppliers (
      id, supplier_slug, supplier_name, status, source_registry
    ) VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (supplier_slug)
    DO UPDATE SET
      supplier_name = EXCLUDED.supplier_name,
      status = EXCLUDED.status,
      source_registry = EXCLUDED.source_registry,
      updated_at = now()`,
    [row.id, row.supplierSlug, row.supplierName, row.status, asJsonb(row.sourceRegistry)]
  );
}

async function upsertPackageImport(pool: Pick<Pool, "query">, rowSet: EcomImportRowSet): Promise<string> {
  const row = rowSet.packageImport;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO ecommerce_supplier_package_imports (
      id, supplier_id, supplier_slug, package_policy_version, package_status,
      package_generated_at, source_git_sha, total_skus_discovered, total_skus_validated,
      usable_count, usable_with_warnings_count, blocked_count, extraction_error_count,
      ai_text_facts_coverage, ocr_facts_coverage, asset_coverage,
      validation_summary, artifact_manifest, import_status, import_errors
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14::jsonb, $15::jsonb, $16::jsonb,
      $17::jsonb, $18::jsonb, $19, $20::jsonb
    )
    ON CONFLICT (supplier_slug, package_generated_at, package_policy_version)
    DO UPDATE SET
      package_status = EXCLUDED.package_status,
      source_git_sha = EXCLUDED.source_git_sha,
      total_skus_discovered = EXCLUDED.total_skus_discovered,
      total_skus_validated = EXCLUDED.total_skus_validated,
      usable_count = EXCLUDED.usable_count,
      usable_with_warnings_count = EXCLUDED.usable_with_warnings_count,
      blocked_count = EXCLUDED.blocked_count,
      extraction_error_count = EXCLUDED.extraction_error_count,
      ai_text_facts_coverage = EXCLUDED.ai_text_facts_coverage,
      ocr_facts_coverage = EXCLUDED.ocr_facts_coverage,
      asset_coverage = EXCLUDED.asset_coverage,
      validation_summary = EXCLUDED.validation_summary,
      artifact_manifest = EXCLUDED.artifact_manifest,
      import_status = EXCLUDED.import_status,
      import_errors = EXCLUDED.import_errors,
      updated_at = now()
    RETURNING id`,
    [
      row.id,
      row.supplierId,
      row.supplierSlug,
      row.packagePolicyVersion,
      row.packageStatus,
      row.packageGeneratedAt,
      row.sourceGitSha,
      row.totalSkusDiscovered,
      row.totalSkusValidated,
      row.usableCount,
      row.usableWithWarningsCount,
      row.blockedCount,
      row.extractionErrorCount,
      asJsonb(row.aiTextFactsCoverage),
      asJsonb(row.ocrFactsCoverage),
      asJsonb(row.assetCoverage),
      asJsonb(row.validationSummary),
      asJsonb(row.artifactManifest),
      row.importStatus,
      asJsonb(row.importErrors),
    ]
  );

  return result.rows[0]?.id ?? row.id;
}

async function upsertProducts(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_products (
        id, supplier_id, supplier_slug, sku, product_name, category, product_type,
        status, validation_status, readiness, missing_fields, blocking_defects,
        warning_defects, source_notes, package_import_id, source_facts
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10::jsonb, $11::jsonb, $12::jsonb,
        $13::jsonb, $14::jsonb, $15, $16::jsonb
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_id = EXCLUDED.supplier_id,
        product_name = EXCLUDED.product_name,
        category = EXCLUDED.category,
        product_type = EXCLUDED.product_type,
        status = EXCLUDED.status,
        validation_status = EXCLUDED.validation_status,
        readiness = EXCLUDED.readiness,
        missing_fields = EXCLUDED.missing_fields,
        blocking_defects = EXCLUDED.blocking_defects,
        warning_defects = EXCLUDED.warning_defects,
        source_notes = EXCLUDED.source_notes,
        package_import_id = EXCLUDED.package_import_id,
        source_facts = EXCLUDED.source_facts,
        updated_at = now()`,
      [
        row.id,
        row.supplier_id,
        row.supplier_slug,
        row.sku,
        row.product_name,
        row.category,
        row.product_type,
        row.status,
        row.validation_status,
        asJsonb(row.readiness),
        asJsonb(row.missing_fields),
        asJsonb(row.blocking_defects),
        asJsonb(row.warning_defects),
        asJsonb(row.source_notes),
        row.package_import_id,
        asJsonb(row.source_facts),
      ]
    );
  }
}

async function upsertProductFacts(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_product_facts (
        id, supplier_product_id, supplier_slug, sku, product_name,
        label_size, container_size, product_weight, key_features,
        dietary_attributes, certifications, manufacturing_claims,
        supplement_facts, directions, warnings, storage, source_evidence,
        extraction_methods, needs_review
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9::jsonb,
        $10::jsonb, $11::jsonb, $12::jsonb,
        $13::jsonb, $14, $15, $16, $17::jsonb,
        $18::jsonb, $19
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        product_name = EXCLUDED.product_name,
        label_size = EXCLUDED.label_size,
        container_size = EXCLUDED.container_size,
        product_weight = EXCLUDED.product_weight,
        key_features = EXCLUDED.key_features,
        dietary_attributes = EXCLUDED.dietary_attributes,
        certifications = EXCLUDED.certifications,
        manufacturing_claims = EXCLUDED.manufacturing_claims,
        supplement_facts = EXCLUDED.supplement_facts,
        directions = EXCLUDED.directions,
        warnings = EXCLUDED.warnings,
        storage = EXCLUDED.storage,
        source_evidence = EXCLUDED.source_evidence,
        extraction_methods = EXCLUDED.extraction_methods,
        needs_review = EXCLUDED.needs_review,
        updated_at = now()`,
      [
        row.id,
        row.supplier_product_id,
        row.supplier_slug,
        row.sku,
        row.product_name,
        row.label_size,
        row.container_size,
        row.product_weight,
        asJsonb(row.key_features),
        asJsonb(row.dietary_attributes),
        asJsonb(row.certifications),
        asJsonb(row.manufacturing_claims),
        asJsonb(row.supplement_facts),
        row.directions,
        row.warnings,
        row.storage,
        asJsonb(row.source_evidence),
        asJsonb(row.extraction_methods),
        row.needs_review,
      ]
    );
  }
}

async function upsertPricing(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_pricing (
        id, supplier_product_id, supplier_slug, sku, currency,
        pricing, tiers, moq, source_evidence
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb, $8, $9::jsonb
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        currency = EXCLUDED.currency,
        pricing = EXCLUDED.pricing,
        tiers = EXCLUDED.tiers,
        moq = EXCLUDED.moq,
        source_evidence = EXCLUDED.source_evidence,
        updated_at = now()`,
      [
        row.id,
        row.supplier_product_id,
        row.supplier_slug,
        row.sku,
        row.currency,
        asJsonb(row.pricing),
        asJsonb(row.tiers),
        row.moq,
        asJsonb(row.source_evidence),
      ]
    );
  }
}

async function upsertInventory(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_inventory (
        id, supplier_product_id, supplier_slug, sku,
        inventory_status, inventory_raw, replenishment_eta,
        comments, source_evidence, updated_by_supplier_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9::jsonb, $10
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        inventory_status = EXCLUDED.inventory_status,
        inventory_raw = EXCLUDED.inventory_raw,
        replenishment_eta = EXCLUDED.replenishment_eta,
        comments = EXCLUDED.comments,
        source_evidence = EXCLUDED.source_evidence,
        updated_by_supplier_at = EXCLUDED.updated_by_supplier_at,
        updated_at = now()`,
      [
        row.id,
        row.supplier_product_id,
        row.supplier_slug,
        row.sku,
        row.inventory_status,
        row.inventory_raw,
        row.replenishment_eta,
        row.comments,
        asJsonb(row.source_evidence),
        row.updated_by_supplier_at,
      ]
    );
  }
}

async function upsertAssets(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_assets (
        id, supplier_product_id, supplier_slug, sku,
        coa_url, catalog_template_url, label_template_ai_url,
        mockup_template_tif_url, assets, asset_readiness,
        remote_metadata, ai_label_text_evidence, ocr_evidence,
        source_evidence, ready_for_optipixel, ready_for_channel_image_generation
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9::jsonb, $10::jsonb,
        $11::jsonb, $12::jsonb, $13::jsonb,
        $14::jsonb, $15, $16
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        coa_url = EXCLUDED.coa_url,
        catalog_template_url = EXCLUDED.catalog_template_url,
        label_template_ai_url = EXCLUDED.label_template_ai_url,
        mockup_template_tif_url = EXCLUDED.mockup_template_tif_url,
        assets = EXCLUDED.assets,
        asset_readiness = EXCLUDED.asset_readiness,
        remote_metadata = EXCLUDED.remote_metadata,
        ai_label_text_evidence = EXCLUDED.ai_label_text_evidence,
        ocr_evidence = EXCLUDED.ocr_evidence,
        source_evidence = EXCLUDED.source_evidence,
        ready_for_optipixel = EXCLUDED.ready_for_optipixel,
        ready_for_channel_image_generation = EXCLUDED.ready_for_channel_image_generation,
        updated_at = now()`,
      [
        row.id,
        row.supplier_product_id,
        row.supplier_slug,
        row.sku,
        row.coa_url,
        row.catalog_template_url,
        row.label_template_ai_url,
        row.mockup_template_tif_url,
        asJsonb(row.assets),
        asJsonb(row.asset_readiness),
        asJsonb(row.remote_metadata),
        asJsonb(row.ai_label_text_evidence),
        asJsonb(row.ocr_evidence),
        asJsonb(row.source_evidence),
        row.ready_for_optipixel,
        row.ready_for_channel_image_generation,
      ]
    );
  }
}

async function upsertValidationResults(pool: Pick<Pool, "query">, rows: Array<Record<string, JsonValue>>): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ecommerce_supplier_validation_results (
        id, supplier_product_id, supplier_slug, sku,
        validation_policy_version, validation_status, package_status_at_import,
        blocking_defects, warning_defects, not_applicable_fields,
        readiness, coverage, needs_review, validation_result
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8::jsonb, $9::jsonb, $10::jsonb,
        $11::jsonb, $12::jsonb, $13, $14::jsonb
      )
      ON CONFLICT (supplier_slug, sku)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        validation_policy_version = EXCLUDED.validation_policy_version,
        validation_status = EXCLUDED.validation_status,
        package_status_at_import = EXCLUDED.package_status_at_import,
        blocking_defects = EXCLUDED.blocking_defects,
        warning_defects = EXCLUDED.warning_defects,
        not_applicable_fields = EXCLUDED.not_applicable_fields,
        readiness = EXCLUDED.readiness,
        coverage = EXCLUDED.coverage,
        needs_review = EXCLUDED.needs_review,
        validation_result = EXCLUDED.validation_result,
        updated_at = now()`,
      [
        row.id,
        row.supplier_product_id,
        row.supplier_slug,
        row.sku,
        row.validation_policy_version,
        row.validation_status,
        row.package_status_at_import,
        asJsonb(row.blocking_defects),
        asJsonb(row.warning_defects),
        asJsonb(row.not_applicable_fields),
        asJsonb(row.readiness),
        asJsonb(row.coverage),
        row.needs_review,
        asJsonb(row.validation_result),
      ]
    );
  }
}

export interface RocktomicImportRunResult {
  rowSet: EcomImportRowSet;
  packageImportId: string;
}

export async function importRocktomicPackageToEcommerceDb(options: {
  pool: Pick<Pool, "query">;
  artifacts: RocktomicPackageArtifacts;
  artifactManifest: Record<string, JsonValue>;
  sourceGitSha?: string | null;
}): Promise<RocktomicImportRunResult> {
  const rowSet = mapRocktomicPackageToEcommerceRows({
    artifacts: options.artifacts,
    artifactManifest: options.artifactManifest,
    sourceGitSha: options.sourceGitSha || null,
    importStatus: "completed",
  });

  await options.pool.query("BEGIN");

  try {
    await upsertSupplier(options.pool, rowSet);
    const packageImportId = await upsertPackageImport(options.pool, rowSet);

    for (const row of rowSet.products) {
      row.package_import_id = packageImportId;
    }

    await upsertProducts(options.pool, rowSet.products);
    await upsertProductFacts(options.pool, rowSet.productFacts);
    await upsertPricing(options.pool, rowSet.pricing);
    await upsertInventory(options.pool, rowSet.inventory);
    await upsertAssets(options.pool, rowSet.assets);
    await upsertValidationResults(options.pool, rowSet.validationResults);

    await options.pool.query("COMMIT");

    return {
      rowSet,
      packageImportId,
    };
  } catch (error) {
    await options.pool.query("ROLLBACK");
    throw error;
  }
}
