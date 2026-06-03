import "server-only";

import { queryEcommerce } from "@/lib/ecommerce/database";

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

export async function listRecentFileIqJobs(limit: number): Promise<FileIqJobListRow[]> {
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
    `SELECT j.id, j.bundle_id, b.name AS bundle_name, j.status, j.agent_session_id,
            j.summary, j.error_code, j.created_at, j.completed_at
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
