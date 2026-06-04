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

export async function listRecentFileIqJobs(limit: number): Promise<FileIqJobListRow[]> {
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
     ORDER BY j.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    bundleId: r.bundle_id,
    bundleName: r.bundle_name,
    status: r.status,
    agentSessionId: r.agent_session_id,
    summary: (r.summary as Record<string, unknown>) ?? {},
    errorCode: r.error_code,
    createdAt: typeof r.created_at === "string" ? r.created_at : String(r.created_at),
    completedAt:
      r.completed_at == null
        ? null
        : typeof r.completed_at === "string"
          ? r.completed_at
          : String(r.completed_at),
  }));
}
