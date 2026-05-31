import "server-only";

import { query } from "@/app/api/ecomviper/_utils/db";
import {
  GLOBAL_SUPPLIER_SCOPE_USER_ID,
  type SupplierSourceSyncStatus,
} from "@/lib/ecomviper/dropshipping/rocktomic-normalized-store";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

export type AdminAuditStatus =
  | "ready"
  | "partial"
  | "missing"
  | "extraction_failed"
  | "not_applicable"
  | "extraction_needed";

export type AdminAuditFilter =
  | "all"
  | "ready"
  | "partial"
  | "missing_pricing"
  | "missing_inventory"
  | "missing_coa"
  | "missing_assets"
  | "missing_key_features"
  | "supplement_facts_not_extracted"
  | "missing_product";

export interface AdminAuditFilterOption {
  value: AdminAuditFilter;
  label: string;
}

export const ADMIN_AUDIT_FILTER_OPTIONS: AdminAuditFilterOption[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "partial", label: "Partial" },
  { value: "missing_pricing", label: "Missing Pricing" },
  { value: "missing_inventory", label: "Missing Inventory" },
  { value: "missing_coa", label: "Missing COA" },
  { value: "missing_assets", label: "Missing Assets" },
  { value: "missing_key_features", label: "Missing Key Features" },
  { value: "supplement_facts_not_extracted", label: "Supplement Facts Not Extracted" },
  { value: "missing_product", label: "Unmatched / Missing Product Record" },
];

export interface AdminSkuAuditRow {
  sku: string;
  productName: string;
  productFactsStatus: AdminAuditStatus;
  pricingStatus: AdminAuditStatus;
  inventoryStatus: AdminAuditStatus;
  coaLinkStatus: AdminAuditStatus;
  labelMockupStatus: AdminAuditStatus;
  supplementFactsStatus: AdminAuditStatus;
  keyFeaturesStatus: AdminAuditStatus;
  generateReadiness: AdminAuditStatus;
  lastSyncedAt: string | null;
  missingProductRecord: boolean;
}

export interface AdminSkuAuditSummary {
  totalSupplierSkus: number;
  readySkus: number;
  partialSkus: number;
  missingCoa: number;
  missingPricing: number;
  missingInventory: number;
  supplementFactsNotExtracted: number;
}

export interface SupplierAdminSummary {
  supplierId: string;
  supplierLabel: string;
  sourceRegistryStatus: SupplierSourceSyncStatus;
  datasetStatus: "healthy" | "degraded" | "missing";
  productCount: number;
  pricingCount: number;
  inventoryCount: number;
  assetCount: number;
  lastSuccessfulSyncAt: string | null;
  lastFailedSyncAt: string | null;
  currentPublishedDatasetVersion: string | null;
  currentReleaseBuildId: string | null;
  sourceStatuses: Array<{
    sourceId: string;
    sourceLabel: string;
    syncStatus: string;
    configured: boolean;
    fetchable: boolean;
    parsed: boolean;
    recordCount: number;
    lastCheckedAt: string | null;
    lastSuccessfulSyncAt: string | null;
    lastError: string | null;
  }>;
}

export interface SupplierBuildHistoryRow {
  runId: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  productCount: number;
  pricingCount: number;
  inventoryCount: number;
  assetCount: number;
  errorSummary: string | null;
  sourceVersion: string | null;
}

function canUseDatabase(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function normalizeSku(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeString(entry)).filter((entry): entry is string => Boolean(entry));
}

function normalizeIso(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return safeIsoDate(normalized, "") || null;
}

function statusFromPresence(options: {
  present: boolean;
  extractionStatus: string | null;
  extractionErrors: string[];
  allowNotApplicable?: boolean;
  allowExtractionNeeded?: boolean;
}): AdminAuditStatus {
  const extractionStatus = options.extractionStatus?.toLowerCase() || null;
  if (extractionStatus === "extraction_failed" || options.extractionErrors.length > 0) {
    return "extraction_failed";
  }
  if (options.allowNotApplicable && extractionStatus === "not_applicable") {
    return "not_applicable";
  }
  if (
    options.allowExtractionNeeded &&
    (extractionStatus === "ocr_required" ||
      extractionStatus === "source_sync_required" ||
      extractionStatus === "source_missing" ||
      extractionStatus === "parsing_partial")
  ) {
    return "extraction_needed";
  }
  if (options.present) return "ready";
  if (extractionStatus && extractionStatus !== "synced") return "partial";
  return "missing";
}

function deriveGenerateReadiness(input: {
  missingProductRecord: boolean;
  pricingStatus: AdminAuditStatus;
  inventoryStatus: AdminAuditStatus;
  coaLinkStatus: AdminAuditStatus;
  labelMockupStatus: AdminAuditStatus;
  supplementFactsStatus: AdminAuditStatus;
  keyFeaturesStatus: AdminAuditStatus;
}): AdminAuditStatus {
  if (input.missingProductRecord) return "missing";
  if (
    input.pricingStatus === "extraction_failed" ||
    input.inventoryStatus === "extraction_failed" ||
    input.coaLinkStatus === "extraction_failed" ||
    input.labelMockupStatus === "extraction_failed" ||
    input.supplementFactsStatus === "extraction_failed" ||
    input.keyFeaturesStatus === "extraction_failed"
  ) {
    return "extraction_failed";
  }

  const requiredStatuses = [
    input.pricingStatus,
    input.inventoryStatus,
    input.coaLinkStatus,
    input.labelMockupStatus,
    input.supplementFactsStatus,
    input.keyFeaturesStatus,
  ];

  if (requiredStatuses.every((status) => status === "ready" || status === "not_applicable")) {
    return "ready";
  }

  if (requiredStatuses.some((status) => status === "missing" || status === "extraction_needed")) {
    return "partial";
  }

  return "partial";
}

function matchesFilter(row: AdminSkuAuditRow, filter: AdminAuditFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "ready":
      return row.generateReadiness === "ready";
    case "partial":
      return row.generateReadiness === "partial" || row.generateReadiness === "extraction_failed";
    case "missing_pricing":
      return row.pricingStatus !== "ready";
    case "missing_inventory":
      return row.inventoryStatus !== "ready";
    case "missing_coa":
      return row.coaLinkStatus !== "ready";
    case "missing_assets":
      return row.labelMockupStatus !== "ready";
    case "missing_key_features":
      return row.keyFeaturesStatus !== "ready";
    case "supplement_facts_not_extracted":
      return row.supplementFactsStatus !== "ready";
    case "missing_product":
      return row.missingProductRecord;
    default:
      return true;
  }
}

function matchesSearch(row: AdminSkuAuditRow, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;
  return row.sku.toLowerCase().includes(normalized) || row.productName.toLowerCase().includes(normalized);
}

function summarizeAuditRows(rows: AdminSkuAuditRow[]): AdminSkuAuditSummary {
  return {
    totalSupplierSkus: rows.length,
    readySkus: rows.filter((row) => row.generateReadiness === "ready").length,
    partialSkus: rows.filter((row) => row.generateReadiness === "partial" || row.generateReadiness === "extraction_failed").length,
    missingCoa: rows.filter((row) => row.coaLinkStatus !== "ready").length,
    missingPricing: rows.filter((row) => row.pricingStatus !== "ready").length,
    missingInventory: rows.filter((row) => row.inventoryStatus !== "ready").length,
    supplementFactsNotExtracted: rows.filter((row) => row.supplementFactsStatus !== "ready").length,
  };
}

export async function getSupplierAdminSummary(supplierId = "rocktomic"): Promise<SupplierAdminSummary> {
  if (!canUseDatabase()) {
    return {
      supplierId,
      supplierLabel: "Rocktomic",
      sourceRegistryStatus: "never_synced",
      datasetStatus: "missing",
      productCount: 0,
      pricingCount: 0,
      inventoryCount: 0,
      assetCount: 0,
      lastSuccessfulSyncAt: null,
      lastFailedSyncAt: null,
      currentPublishedDatasetVersion: null,
      currentReleaseBuildId: null,
      sourceStatuses: [],
    };
  }

  try {
    const [countRows, statusRows, successRows, failedRows, versionRows, buildRows] = await Promise.all([
      query<{
        products_count: number;
        pricing_count: number;
        inventory_count: number;
        assets_count: number;
      }>(
        `
          SELECT
            (SELECT COUNT(*)::int FROM supplier_products_normalized WHERE user_id = $1 AND supplier_id = $2) AS products_count,
            (SELECT COUNT(*)::int FROM supplier_pricing_normalized WHERE user_id = $1 AND supplier_id = $2) AS pricing_count,
            (SELECT COUNT(*)::int FROM supplier_inventory_normalized WHERE user_id = $1 AND supplier_id = $2) AS inventory_count,
            (SELECT COUNT(*)::int FROM supplier_assets_normalized WHERE user_id = $1 AND supplier_id = $2) AS assets_count
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{
        source_id: string;
        source_label: string;
        sync_status: string;
        configured: boolean;
        fetchable: boolean;
        parsed: boolean;
        record_count: number;
        last_checked_at: string | null;
        last_successful_sync_at: string | null;
        last_error: string | null;
      }>(
        `
          SELECT
            source_id,
            source_label,
            sync_status,
            configured,
            fetchable,
            parsed,
            record_count,
            last_checked_at,
            last_successful_sync_at,
            last_error
          FROM supplier_source_sync_status
          WHERE user_id = $1 AND supplier_id = $2
          ORDER BY source_label ASC
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{ completed_at: string | null }>(
        `
          SELECT completed_at
          FROM supplier_source_sync_runs
          WHERE user_id = $1 AND supplier_id = $2 AND sync_status = 'synced'
          ORDER BY attempted_at DESC
          LIMIT 1
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{ attempted_at: string | null }>(
        `
          SELECT attempted_at
          FROM supplier_source_sync_runs
          WHERE user_id = $1 AND supplier_id = $2 AND sync_status IN ('sync_failed', 'source_inaccessible', 'source_auth_required')
          ORDER BY attempted_at DESC
          LIMIT 1
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{ source_version: string | null }>(
        `
          SELECT source_version
          FROM supplier_products_normalized
          WHERE user_id = $1 AND supplier_id = $2 AND source_version IS NOT NULL
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{ build_id: string | null }>(
        `
          SELECT build_id
          FROM app_release_metadata
          ORDER BY deployed_at DESC
          LIMIT 1
        `,
        []
      ).catch(() => []),
    ]);

    const counts = countRows[0] || {
      products_count: 0,
      pricing_count: 0,
      inventory_count: 0,
      assets_count: 0,
    };

    const sourceRegistryStatus = (statusRows[0]?.sync_status || "never_synced") as SupplierSourceSyncStatus;
    const datasetStatus: SupplierAdminSummary["datasetStatus"] =
      counts.products_count === 0
        ? "missing"
        : statusRows.some((status) => status.sync_status.includes("failed") || Boolean(status.last_error))
          ? "degraded"
          : "healthy";

    return {
      supplierId,
      supplierLabel: "Rocktomic",
      sourceRegistryStatus,
      datasetStatus,
      productCount: counts.products_count,
      pricingCount: counts.pricing_count,
      inventoryCount: counts.inventory_count,
      assetCount: counts.assets_count,
      lastSuccessfulSyncAt: normalizeIso(successRows[0]?.completed_at),
      lastFailedSyncAt: normalizeIso(failedRows[0]?.attempted_at),
      currentPublishedDatasetVersion: normalizeString(versionRows[0]?.source_version),
      currentReleaseBuildId: normalizeString(buildRows[0]?.build_id),
      sourceStatuses: statusRows.map((status) => ({
        sourceId: status.source_id,
        sourceLabel: status.source_label,
        syncStatus: status.sync_status,
        configured: Boolean(status.configured),
        fetchable: Boolean(status.fetchable),
        parsed: Boolean(status.parsed),
        recordCount: Number(status.record_count || 0),
        lastCheckedAt: normalizeIso(status.last_checked_at),
        lastSuccessfulSyncAt: normalizeIso(status.last_successful_sync_at),
        lastError: normalizeString(status.last_error),
      })),
    };
  } catch {
    return {
      supplierId,
      supplierLabel: "Rocktomic",
      sourceRegistryStatus: "never_synced",
      datasetStatus: "missing",
      productCount: 0,
      pricingCount: 0,
      inventoryCount: 0,
      assetCount: 0,
      lastSuccessfulSyncAt: null,
      lastFailedSyncAt: null,
      currentPublishedDatasetVersion: null,
      currentReleaseBuildId: null,
      sourceStatuses: [],
    };
  }
}

export async function getSupplierBuildHistory(
  supplierId = "rocktomic",
  options?: { limit?: number }
): Promise<SupplierBuildHistoryRow[]> {
  if (!canUseDatabase()) return [];

  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));

  try {
    const rows = await query<{
      id: number;
      sync_status: string;
      attempted_at: string | null;
      completed_at: string | null;
      products_parsed_count: number;
      pricing_records_parsed_count: number;
      inventory_records_parsed_count: number;
      asset_records_parsed_count: number;
      last_error: string | null;
      source_diagnostics: unknown;
    }>(
      `
        SELECT
          id,
          sync_status,
          attempted_at,
          completed_at,
          products_parsed_count,
          pricing_records_parsed_count,
          inventory_records_parsed_count,
          asset_records_parsed_count,
          last_error,
          source_diagnostics
        FROM supplier_source_sync_runs
        WHERE user_id = $1 AND supplier_id = $2
        ORDER BY attempted_at DESC
        LIMIT $3
      `,
      [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId, limit]
    );

    return rows.map((row) => {
      const startedAt = normalizeIso(row.attempted_at);
      const finishedAt = normalizeIso(row.completed_at);
      const durationSeconds = startedAt && finishedAt
        ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000))
        : null;

      const diagnostics = Array.isArray(row.source_diagnostics)
        ? (row.source_diagnostics as Array<Record<string, unknown>>)
        : [];
      const versionFromDiagnostics = diagnostics
        .map((entry) => normalizeString(entry.sourceVersion) || normalizeString(entry.source_version))
        .find(Boolean) || null;

      return {
        runId: Number(row.id),
        status: normalizeString(row.sync_status) || "unknown",
        startedAt,
        finishedAt,
        durationSeconds,
        productCount: Number(row.products_parsed_count || 0),
        pricingCount: Number(row.pricing_records_parsed_count || 0),
        inventoryCount: Number(row.inventory_records_parsed_count || 0),
        assetCount: Number(row.asset_records_parsed_count || 0),
        errorSummary: normalizeString(row.last_error),
        sourceVersion: versionFromDiagnostics,
      };
    });
  } catch {
    return [];
  }
}

export async function getSupplierAuditData(input?: {
  supplierId?: string;
  filter?: AdminAuditFilter;
  searchTerm?: string;
}): Promise<{
  rows: AdminSkuAuditRow[];
  summary: AdminSkuAuditSummary;
  filteredCount: number;
}> {
  const supplierId = input?.supplierId || "rocktomic";
  const filter = input?.filter || "all";
  const searchTerm = input?.searchTerm || "";

  if (!canUseDatabase()) {
    const empty: AdminSkuAuditRow[] = [];
    return {
      rows: empty,
      summary: summarizeAuditRows(empty),
      filteredCount: 0,
    };
  }

  try {
    const [skuRows, productRows, pricingRows, inventoryRows, assetRows] = await Promise.all([
      query<{ sku: string }>(
        `
          SELECT sku
          FROM (
            SELECT sku FROM supplier_products_normalized WHERE user_id = $1 AND supplier_id = $2
            UNION
            SELECT sku FROM supplier_pricing_normalized WHERE user_id = $1 AND supplier_id = $2
            UNION
            SELECT sku FROM supplier_inventory_normalized WHERE user_id = $1 AND supplier_id = $2
            UNION
            SELECT sku FROM supplier_assets_normalized WHERE user_id = $1 AND supplier_id = $2
          ) AS sku_union
          ORDER BY sku ASC
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{
        sku: string;
        product_name: string;
        supplement_facts_text: string | null;
        supplement_facts_raw: string | null;
        key_product_features: unknown;
        coa_url: string | null;
        label_template_url: string | null;
        mockup_url: string | null;
        extraction_status: string | null;
        extraction_errors: unknown;
        last_synced_at: string | null;
      }>(
        `
          SELECT
            sku,
            product_name,
            supplement_facts_text,
            supplement_facts_raw,
            key_product_features,
            coa_url,
            label_template_url,
            mockup_url,
            extraction_status,
            extraction_errors,
            last_synced_at
          FROM supplier_products_normalized
          WHERE user_id = $1 AND supplier_id = $2
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{
        sku: string;
        extraction_status: string | null;
        extraction_errors: unknown;
        last_synced_at: string | null;
      }>(
        `
          SELECT sku, extraction_status, extraction_errors, last_synced_at
          FROM supplier_pricing_normalized
          WHERE user_id = $1 AND supplier_id = $2
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{
        sku: string;
        extraction_status: string | null;
        extraction_errors: unknown;
        last_synced_at: string | null;
      }>(
        `
          SELECT sku, extraction_status, extraction_errors, last_synced_at
          FROM supplier_inventory_normalized
          WHERE user_id = $1 AND supplier_id = $2
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
      query<{
        sku: string;
        label_template_url: string | null;
        mockup_url: string | null;
        coa_url: string | null;
        extraction_status: string | null;
        extraction_errors: unknown;
        last_synced_at: string | null;
      }>(
        `
          SELECT
            sku,
            label_template_url,
            mockup_url,
            coa_url,
            extraction_status,
            extraction_errors,
            last_synced_at
          FROM supplier_assets_normalized
          WHERE user_id = $1 AND supplier_id = $2
        `,
        [GLOBAL_SUPPLIER_SCOPE_USER_ID, supplierId]
      ),
    ]);

    const productBySku = new Map(productRows.map((row) => [normalizeSku(row.sku), row]));
    const pricingBySku = new Map(pricingRows.map((row) => [normalizeSku(row.sku), row]));
    const inventoryBySku = new Map(inventoryRows.map((row) => [normalizeSku(row.sku), row]));
    const assetsBySku = new Map(assetRows.map((row) => [normalizeSku(row.sku), row]));

    const allRows = skuRows
      .map((row) => normalizeSku(row.sku))
      .filter(Boolean)
      .map((sku) => {
        const product = productBySku.get(sku);
        const pricing = pricingBySku.get(sku);
        const inventory = inventoryBySku.get(sku);
        const assets = assetsBySku.get(sku);

        const productFactsStatus = statusFromPresence({
          present: Boolean(product),
          extractionStatus: normalizeString(product?.extraction_status),
          extractionErrors: normalizeStringArray(product?.extraction_errors),
        });

        const pricingStatus = statusFromPresence({
          present: Boolean(pricing),
          extractionStatus: normalizeString(pricing?.extraction_status),
          extractionErrors: normalizeStringArray(pricing?.extraction_errors),
        });

        const inventoryStatus = statusFromPresence({
          present: Boolean(inventory),
          extractionStatus: normalizeString(inventory?.extraction_status),
          extractionErrors: normalizeStringArray(inventory?.extraction_errors),
        });

        const coaPresent = Boolean(normalizeString(product?.coa_url) || normalizeString(assets?.coa_url));
        const coaLinkStatus = statusFromPresence({
          present: coaPresent,
          extractionStatus: normalizeString(product?.extraction_status) || normalizeString(assets?.extraction_status),
          extractionErrors: [
            ...normalizeStringArray(product?.extraction_errors),
            ...normalizeStringArray(assets?.extraction_errors),
          ],
          allowNotApplicable: true,
        });

        const labelMockupStatus = statusFromPresence({
          present: Boolean(
            normalizeString(product?.label_template_url) ||
              normalizeString(product?.mockup_url) ||
              normalizeString(assets?.label_template_url) ||
              normalizeString(assets?.mockup_url)
          ),
          extractionStatus: normalizeString(assets?.extraction_status) || normalizeString(product?.extraction_status),
          extractionErrors: [
            ...normalizeStringArray(product?.extraction_errors),
            ...normalizeStringArray(assets?.extraction_errors),
          ],
        });

        const supplementFactsStatus = statusFromPresence({
          present: Boolean(normalizeString(product?.supplement_facts_text) || normalizeString(product?.supplement_facts_raw)),
          extractionStatus: normalizeString(product?.extraction_status),
          extractionErrors: normalizeStringArray(product?.extraction_errors),
          allowExtractionNeeded: true,
        });

        const keyFeaturesStatus = statusFromPresence({
          present: normalizeStringArray(product?.key_product_features).length > 0,
          extractionStatus: normalizeString(product?.extraction_status),
          extractionErrors: normalizeStringArray(product?.extraction_errors),
          allowNotApplicable: true,
        });

        const missingProductRecord = !product;
        const generateReadiness = deriveGenerateReadiness({
          missingProductRecord,
          pricingStatus,
          inventoryStatus,
          coaLinkStatus,
          labelMockupStatus,
          supplementFactsStatus,
          keyFeaturesStatus,
        });

        const lastSyncedAt = [
          normalizeIso(product?.last_synced_at),
          normalizeIso(pricing?.last_synced_at),
          normalizeIso(inventory?.last_synced_at),
          normalizeIso(assets?.last_synced_at),
        ]
          .filter((entry): entry is string => Boolean(entry))
          .sort()
          .at(-1) || null;

        return {
          sku,
          productName: normalizeString(product?.product_name) || "Missing product record",
          productFactsStatus,
          pricingStatus,
          inventoryStatus,
          coaLinkStatus,
          labelMockupStatus,
          supplementFactsStatus,
          keyFeaturesStatus,
          generateReadiness,
          lastSyncedAt,
          missingProductRecord,
        } satisfies AdminSkuAuditRow;
      });

    const summary = summarizeAuditRows(allRows);
    const filteredRows = allRows
      .filter((row) => matchesFilter(row, filter))
      .filter((row) => matchesSearch(row, searchTerm));

    return {
      rows: filteredRows,
      summary,
      filteredCount: filteredRows.length,
    };
  } catch {
    const empty: AdminSkuAuditRow[] = [];
    return {
      rows: empty,
      summary: summarizeAuditRows(empty),
      filteredCount: 0,
    };
  }
}
