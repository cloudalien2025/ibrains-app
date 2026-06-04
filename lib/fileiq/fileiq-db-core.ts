import { queryEcommerce } from "@/lib/ecommerce/database";

export interface FileIqWorkerContext {
  agentPrompt: string;
  cwd: string | null;
  additionalDirectories: string[];
  maxTurns: number;
}

export interface FileIqSourceBundleInsert {
  id: string;
  supplierId: string;
  name: string;
  status: string;
  createdBy: string;
  metadata: Record<string, unknown>;
}

export interface FileIqSourceFileInsert {
  id: string;
  bundleId: string;
  supplierId: string;
  fileName: string;
  fileType: string;
  sourceRole: string;
  storageUri: string;
  contentHash: string;
  status: string;
  metadata: Record<string, unknown>;
}

export interface FileIqExtractionJobInsert {
  id: string;
  bundleId: string;
  status: string;
  extractorType: string;
  summary: Record<string, unknown>;
}

export interface FileIqExtractionJobUpdate {
  status: string;
  agentSessionId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  summary: Record<string, unknown>;
}

export interface FileIqRawExtractionInsert {
  id: string;
  extractionJobId: string;
  sourceFileId: string | null;
  artifactType: string;
  storageUri: string;
  payload: Record<string, unknown>;
}

export interface FileIqJobListRow {
  id: string;
  bundleId: string;
  bundleName: string;
  status: string;
  agentSessionId: string | null;
  summary: Record<string, unknown>;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface FileIqOwnedJob extends FileIqJobListRow {
  errorMessage: string | null;
}

export interface FileIqStoredArtifact {
  id: string;
  extractionJobId: string;
  artifactType: string;
  storageUri: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FileIqSupplierArtifactRecord {
  artifactId: string;
  jobId: string;
  bundleId: string;
  bundleName: string;
  supplierId: string;
  sourceFileId: string | null;
  sourceFileName: string | null;
  sourceFileType: string | null;
  sourceRole: string | null;
  sourceMetadata: Record<string, unknown>;
  artifactType: string;
  storageUri: string;
  payload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface FileIqReconciledCatalogRecord {
  id: string;
  supplierId: string;
  sourceBundleId: string | null;
  status: string;
  schemaVersion: string;
  catalog: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface FileIqJobDeletionContext {
  job: FileIqOwnedJob;
  cleanupStorageUris: string[];
}

function mapFileIqJobRow(
  row: {
    id: string;
    bundle_id: string;
    bundle_name: string;
    status: string;
    agent_session_id: string | null;
    summary: unknown;
    error_code: string | null;
    error_message?: string | null;
    created_at: string;
    completed_at: string | null;
  },
): FileIqOwnedJob {
  return {
    id: row.id,
    bundleId: row.bundle_id,
    bundleName: row.bundle_name,
    status: row.status,
    agentSessionId: row.agent_session_id,
    summary: (row.summary as Record<string, unknown>) ?? {},
    errorCode: row.error_code,
    errorMessage: row.error_message ?? null,
    createdAt: typeof row.created_at === "string" ? row.created_at : String(row.created_at),
    completedAt:
      row.completed_at == null
        ? null
        : typeof row.completed_at === "string"
          ? row.completed_at
          : String(row.completed_at),
  };
}

export async function backfillFileIqCompletedJobSuppliers(): Promise<number> {
  const rows = await queryEcommerce<{ id: string }>(
    `WITH latest_raw AS (
       SELECT DISTINCT ON (extraction_job_id)
              extraction_job_id,
              payload
       FROM fileiq_raw_extractions
       ORDER BY extraction_job_id, created_at DESC
     ),
     supplier_names AS (
       SELECT j.id,
              COALESCE(
                NULLIF(latest_raw.payload #>> '{supplier,name}', ''),
                NULLIF(latest_raw.payload #>> '{supplier,supplierName}', '')
              ) AS supplier_name
       FROM fileiq_extraction_jobs j
       JOIN latest_raw ON latest_raw.extraction_job_id = j.id
       WHERE j.status = 'completed'
         AND COALESCE(NULLIF(j.summary ->> 'supplierName', ''), 'Unknown Supplier') = 'Unknown Supplier'
     )
     UPDATE fileiq_extraction_jobs j
     SET summary = jsonb_set(COALESCE(j.summary, '{}'::jsonb), '{supplierName}', to_jsonb(s.supplier_name), true),
         updated_at = now()
     FROM supplier_names s
     WHERE j.id = s.id
       AND s.supplier_name IS NOT NULL
     RETURNING j.id`,
    [],
  );
  return rows.length;
}

export async function insertFileIqSourceBundle(row: FileIqSourceBundleInsert): Promise<void> {
  await queryEcommerce(
    `INSERT INTO fileiq_source_bundles
       (id, supplier_id, name, status, created_by, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [row.id, row.supplierId, row.name, row.status, row.createdBy, JSON.stringify(row.metadata)],
  );
}

export async function insertFileIqSourceFile(row: FileIqSourceFileInsert): Promise<void> {
  await queryEcommerce(
    `INSERT INTO fileiq_source_files
       (id, bundle_id, supplier_id, file_name, file_type, source_role,
        storage_uri, content_hash, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (bundle_id, content_hash) DO NOTHING`,
    [
      row.id,
      row.bundleId,
      row.supplierId,
      row.fileName,
      row.fileType,
      row.sourceRole,
      row.storageUri,
      row.contentHash,
      row.status,
      JSON.stringify(row.metadata),
    ],
  );
}

export async function insertFileIqExtractionJob(row: FileIqExtractionJobInsert): Promise<void> {
  await queryEcommerce(
    `INSERT INTO fileiq_extraction_jobs
       (id, bundle_id, status, extractor_type, started_at, summary, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), $5, now(), now())`,
    [row.id, row.bundleId, row.status, row.extractorType, JSON.stringify(row.summary)],
  );
}

export async function updateFileIqExtractionJob(
  id: string,
  update: FileIqExtractionJobUpdate,
): Promise<void> {
  await queryEcommerce(
    `UPDATE fileiq_extraction_jobs
     SET status = $2, agent_session_id = $3, completed_at = now(),
         error_code = $4, error_message = $5, summary = $6, updated_at = now()
     WHERE id = $1`,
    [
      id,
      update.status,
      update.agentSessionId,
      update.errorCode,
      update.errorMessage,
      JSON.stringify(update.summary),
    ],
  );
}

export async function insertFileIqRawExtraction(row: FileIqRawExtractionInsert): Promise<void> {
  await queryEcommerce(
    `INSERT INTO fileiq_raw_extractions
       (id, extraction_job_id, source_file_id, artifact_type, storage_uri, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [
      row.id,
      row.extractionJobId,
      row.sourceFileId,
      row.artifactType,
      row.storageUri,
      JSON.stringify(row.payload),
    ],
  );
}

export interface FileIqClaimedJob {
  id: string;
  bundleId: string;
  summary: Record<string, unknown>;
}

/**
 * Atomically claim one pending extraction job for the worker.
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers never double-claim.
 * Returns null when no pending jobs exist.
 */
export async function claimFileIqPendingJob(): Promise<FileIqClaimedJob | null> {
  const rows = await queryEcommerce<{ id: string; bundle_id: string; summary: unknown }>(
    `UPDATE fileiq_extraction_jobs
     SET status = 'running', updated_at = now()
     WHERE id = (
       SELECT id FROM fileiq_extraction_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, bundle_id, summary`,
    [],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    bundleId: row.bundle_id,
    summary: (row.summary as Record<string, unknown>) ?? {},
  };
}

export async function listRecentFileIqJobs(limit: number, userId?: string | null): Promise<FileIqJobListRow[]> {
  await backfillFileIqCompletedJobSuppliers();

  const rows = await queryEcommerce<{
    id: string;
    bundle_id: string;
    bundle_name: string;
    status: string;
    agent_session_id: string | null;
    summary: unknown;
    error_code: string | null;
    created_at: string;
    completed_at: string | null;
  }>(
    // Strip _worker (contains agent prompt) from summary — it's only needed by the worker process.
    `SELECT j.id, j.bundle_id, b.name AS bundle_name, j.status, j.agent_session_id,
            j.summary - '_worker' AS summary, j.error_code, j.created_at, j.completed_at
     FROM fileiq_extraction_jobs j
     JOIN fileiq_source_bundles b ON b.id = j.bundle_id
     WHERE ($2::text IS NULL OR b.created_by = $2)
     ORDER BY j.created_at DESC
     LIMIT $1`,
    [limit, userId ?? null],
  );
  return rows.map((r) => mapFileIqJobRow(r));
}

export async function getFileIqJobForUser(
  userId: string,
  jobId: string,
): Promise<FileIqOwnedJob | null> {
  const rows = await queryEcommerce<{
    id: string;
    bundle_id: string;
    bundle_name: string;
    status: string;
    agent_session_id: string | null;
    summary: unknown;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
  }>(
    `SELECT j.id, j.bundle_id, b.name AS bundle_name, j.status, j.agent_session_id,
            j.summary - '_worker' AS summary, j.error_code, j.error_message, j.created_at, j.completed_at
     FROM fileiq_extraction_jobs j
     JOIN fileiq_source_bundles b ON b.id = j.bundle_id
     WHERE j.id = $1
       AND b.created_by = $2
     LIMIT 1`,
    [jobId, userId],
  );

  return rows.length > 0 ? mapFileIqJobRow(rows[0]) : null;
}

export async function getLatestFileIqArtifactForUser(
  userId: string,
  jobId: string,
  artifactTypes: string[],
): Promise<FileIqStoredArtifact | null> {
  if (artifactTypes.length === 0) return null;

  const rows = await queryEcommerce<{
    id: string;
    extraction_job_id: string;
    artifact_type: string;
    storage_uri: string;
    payload: unknown;
    created_at: string;
  }>(
    `SELECT r.id, r.extraction_job_id, r.artifact_type, r.storage_uri, r.payload, r.created_at
     FROM fileiq_raw_extractions r
     JOIN fileiq_extraction_jobs j ON j.id = r.extraction_job_id
     JOIN fileiq_source_bundles b ON b.id = j.bundle_id
     WHERE r.extraction_job_id = $1
       AND b.created_by = $2
       AND r.artifact_type = ANY($3::text[])
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [jobId, userId, artifactTypes],
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    extractionJobId: row.extraction_job_id,
    artifactType: row.artifact_type,
    storageUri: row.storage_uri,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: typeof row.created_at === "string" ? row.created_at : String(row.created_at),
  };
}

export async function getFileIqJobDeletionContextForUser(
  userId: string,
  jobId: string,
): Promise<FileIqJobDeletionContext | null> {
  const job = await getFileIqJobForUser(userId, jobId);
  if (!job) return null;

  const sourceFileRows = await queryEcommerce<{ storage_uri: string }>(
    `SELECT storage_uri
     FROM fileiq_source_files
     WHERE bundle_id = $1`,
    [job.bundleId],
  );
  const artifactRows = await queryEcommerce<{ storage_uri: string }>(
    `SELECT r.storage_uri
     FROM fileiq_raw_extractions r
     WHERE r.extraction_job_id = $1`,
    [job.id],
  );

  const cleanupStorageUris = Array.from(
    new Set(
      [...sourceFileRows, ...artifactRows]
        .map((row) => row.storage_uri)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );

  return { job, cleanupStorageUris };
}

export async function deleteFileIqSourceBundleForUser(
  userId: string,
  bundleId: string,
): Promise<boolean> {
  const rows = await queryEcommerce<{ id: string }>(
    `DELETE FROM fileiq_source_bundles
     WHERE id = $1
       AND created_by = $2
     RETURNING id`,
    [bundleId, userId],
  );
  return rows.length > 0;
}

export async function listLatestCompletedFileIqArtifactsForSupplier(
  supplierIds: string[],
  limit: number,
): Promise<FileIqSupplierArtifactRecord[]> {
  if (supplierIds.length === 0) return [];

  const rows = await queryEcommerce<{
    artifact_id: string;
    extraction_job_id: string;
    bundle_id: string;
    bundle_name: string;
    supplier_id: string;
    source_file_id: string | null;
    source_file_name: string | null;
    source_file_type: string | null;
    source_role: string | null;
    source_metadata: unknown;
    bundle_source_file_name: string | null;
    bundle_source_file_type: string | null;
    bundle_source_role: string | null;
    bundle_source_metadata: unknown;
    artifact_type: string;
    storage_uri: string;
    payload: unknown;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT
       r.id AS artifact_id,
       r.extraction_job_id,
       j.bundle_id,
       b.name AS bundle_name,
       b.supplier_id,
       r.source_file_id,
       sf.file_name AS source_file_name,
       sf.file_type AS source_file_type,
       sf.source_role,
       sf.metadata AS source_metadata,
       sf_bundle.file_name AS bundle_source_file_name,
       sf_bundle.file_type AS bundle_source_file_type,
       sf_bundle.source_role AS bundle_source_role,
       sf_bundle.metadata AS bundle_source_metadata,
       r.artifact_type,
       r.storage_uri,
       r.payload,
       b.created_by,
       r.created_at
     FROM fileiq_raw_extractions r
     JOIN fileiq_extraction_jobs j ON j.id = r.extraction_job_id
     JOIN fileiq_source_bundles b ON b.id = j.bundle_id
     LEFT JOIN fileiq_source_files sf ON sf.id = r.source_file_id
     LEFT JOIN LATERAL (
       SELECT file_name, file_type, source_role, metadata
       FROM fileiq_source_files bundle_sf
       WHERE bundle_sf.bundle_id = j.bundle_id
       ORDER BY bundle_sf.created_at ASC
       LIMIT 1
     ) sf_bundle ON true
     WHERE j.status = 'completed'
       AND b.supplier_id = ANY($1::text[])
       AND r.artifact_type = ANY($2::text[])
     ORDER BY r.created_at DESC
     LIMIT $3`,
    [supplierIds, ["agent_result", "deterministic_result"], limit],
  );

  return rows.map((row) => ({
    artifactId: row.artifact_id,
    jobId: row.extraction_job_id,
    bundleId: row.bundle_id,
    bundleName: row.bundle_name,
    supplierId: row.supplier_id,
    sourceFileId: row.source_file_id,
    sourceFileName: row.source_file_name ?? row.bundle_source_file_name,
    sourceFileType: row.source_file_type ?? row.bundle_source_file_type,
    sourceRole: row.source_role ?? row.bundle_source_role,
    sourceMetadata:
      (row.source_metadata as Record<string, unknown>) ??
      (row.bundle_source_metadata as Record<string, unknown>) ??
      {},
    artifactType: row.artifact_type,
    storageUri: row.storage_uri,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdBy: row.created_by,
    createdAt: typeof row.created_at === "string" ? row.created_at : String(row.created_at),
  }));
}

export async function insertFileIqReconciledCatalog(
  row: FileIqReconciledCatalogRecord,
): Promise<void> {
  await queryEcommerce(
    `INSERT INTO fileiq_reconciled_catalogs
       (id, supplier_id, source_bundle_id, status, schema_version, catalog, metadata, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      row.id,
      row.supplierId,
      row.sourceBundleId,
      row.status,
      row.schemaVersion,
      JSON.stringify(row.catalog),
      JSON.stringify(row.metadata),
      row.createdBy,
    ],
  );
}

export async function getLatestFileIqReconciledCatalogForSupplier(
  supplierIds: string[],
): Promise<FileIqReconciledCatalogRecord | null> {
  if (supplierIds.length === 0) return null;

  const rows = await queryEcommerce<{
    id: string;
    supplier_id: string;
    source_bundle_id: string | null;
    status: string;
    schema_version: string;
    catalog: unknown;
    metadata: unknown;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT id, supplier_id, source_bundle_id, status, schema_version, catalog, metadata, created_by, created_at
     FROM fileiq_reconciled_catalogs
     WHERE supplier_id = ANY($1::text[])
     ORDER BY created_at DESC
     LIMIT 1`,
    [supplierIds],
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    supplierId: row.supplier_id,
    sourceBundleId: row.source_bundle_id,
    status: row.status,
    schemaVersion: row.schema_version,
    catalog: (row.catalog as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: row.created_by,
    createdAt: typeof row.created_at === "string" ? row.created_at : String(row.created_at),
  };
}
