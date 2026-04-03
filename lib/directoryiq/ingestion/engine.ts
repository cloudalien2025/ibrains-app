import { getBrainLearningPool } from "@/lib/brain-learning/db";
import { runBrainTaxonomyEnrichment } from "@/lib/brain-learning/taxonomyEnrichment";
import {
  type DedupeDecision,
  type IngestSourceType,
  type NormalizedIngestItem,
  sha256Hex,
} from "@/lib/directoryiq/ingestion/contracts";

type SourceKind = "youtube_video" | "web_doc" | "other";
type DocumentKind = "transcript" | "source_text";

type SourceItemRow = {
  id: string;
  source_kind: SourceKind;
  source_item_id: string;
};

type CurrentDocumentRow = {
  id: string;
  content_sha256: string | null;
  version_no: number;
};

type IngestOutcomeCounter = {
  candidates_found: number;
  new_items_added: number;
  duplicates_skipped: number;
  updated_items: number;
  versioned_items: number;
  eligible_for_processing: number;
  failed_items: number;
};

export type MultiSourceIngestSummary = IngestOutcomeCounter & {
  brain_id: string;
  source_type: IngestSourceType;
  source_totals: Record<IngestSourceType, number>;
  failures: Array<{ source_key: string; reason: string }>;
};

function mapSourceKind(sourceType: IngestSourceType): SourceKind {
  switch (sourceType) {
    case "youtube":
      return "youtube_video";
    case "web_search":
    case "website_url":
      return "web_doc";
    case "document_upload":
      return "other";
  }
}

function mapDocumentKind(sourceType: IngestSourceType): DocumentKind {
  return sourceType === "youtube" ? "transcript" : "source_text";
}

function sourceIdentityComment(sourceType: IngestSourceType): string {
  switch (sourceType) {
    case "web_search":
      return "identity: canonical normalized page URL";
    case "website_url":
      return "identity: canonical normalized page URL";
    case "document_upload":
      return "identity: uploaded file hash";
    case "youtube":
      return "identity: youtube video_id";
  }
}

export function resolveDecision(
  sourceType: IngestSourceType,
  current: CurrentDocumentRow | null,
  contentHash: string
): DedupeDecision {
  if (!current) return "create";
  if (current.content_sha256 && current.content_sha256 === contentHash) return "skip";
  if (sourceType === "document_upload") return "version";
  if (sourceType === "youtube") {
    // Existing iBrains behavior for YouTube transcript reingest is versioned documents.
    return "version";
  }
  return "update";
}

function chunkText(content: string, chunkSize = 1800, overlap = 200): Array<{ index: number; text: string }> {
  const normalized = content.trim();
  if (!normalized) return [];

  const chunks: Array<{ index: number; text: string }> = [];
  let cursor = 0;
  let index = 0;
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize);
    const text = normalized.slice(cursor, end).trim();
    if (text) {
      chunks.push({ index, text });
      index += 1;
    }
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
}

async function createRun(params: {
  brainId: string;
  sourceItemId: string;
  decision: DedupeDecision;
  sourceType: IngestSourceType;
  item: NormalizedIngestItem;
}): Promise<string> {
  const pool = getBrainLearningPool();
  const attemptNoResult = await pool.query<{ attempt_no: number }>(
    `
      SELECT COALESCE(MAX(attempt_no), 0) + 1 AS attempt_no
      FROM brain_ingest_runs
      WHERE source_item_id = $1
    `,
    [params.sourceItemId]
  );
  const attemptNo = attemptNoResult.rows[0]?.attempt_no ?? 1;

  const inserted = await pool.query<{ id: string }>(
    `
      INSERT INTO brain_ingest_runs (
        brain_id,
        source_item_id,
        status,
        trigger_type,
        ingest_reason,
        attempt_no,
        queued_at,
        started_at,
        metadata
      )
      VALUES (
        $1,
        $2,
        'processing',
        'manual',
        $3,
        $4,
        now(),
        now(),
        $5::jsonb
      )
      RETURNING id
    `,
    [
      params.brainId,
      params.sourceItemId,
      `directoryiq_${params.sourceType}_ingest`,
      attemptNo,
      JSON.stringify({
        source_type: params.sourceType,
        dedupe_decision: params.decision,
        source_key: params.item.source_key,
        source_locator: params.item.source_locator,
        content_hash: params.item.content_hash,
      }),
    ]
  );

  const runId = inserted.rows[0]?.id;
  if (!runId) throw new Error("Failed to create ingest run");
  return runId;
}

async function updateRunStatus(
  runId: string,
  status: "completed" | "failed" | "skipped_duplicate",
  metadata: Record<string, unknown>,
  error?: string
): Promise<void> {
  const pool = getBrainLearningPool();
  await pool.query(
    `
      UPDATE brain_ingest_runs
      SET status = $2,
          completed_at = now(),
          updated_at = now(),
          metadata = $3::jsonb,
          error_code = $4,
          error_message = $5
      WHERE id = $1
    `,
    [runId, status, JSON.stringify(metadata), error ? "DIRECTORYIQ_INGEST_FAILED" : null, error ?? null]
  );
}

async function upsertSourceItem(params: {
  brainId: string;
  item: NormalizedIngestItem;
}): Promise<SourceItemRow> {
  const pool = getBrainLearningPool();
  const sourceKind = mapSourceKind(params.item.source_type);
  const payloadHash = sha256Hex(JSON.stringify(params.item.metadata ?? {}));
  const inserted = await pool.query<SourceItemRow>(
    `
      INSERT INTO brain_source_items (
        brain_id,
        source_kind,
        source_item_id,
        canonical_identity,
        source_url,
        title,
        source_payload,
        source_payload_hash,
        transcript_hash,
        content_hash,
        ingest_source_type,
        last_seen_at,
        discovered_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        $8,
        $9,
        $9,
        $10,
        $11::timestamptz,
        now(),
        now()
      )
      ON CONFLICT (brain_id, source_kind, canonical_identity)
      DO UPDATE SET
        source_item_id = EXCLUDED.source_item_id,
        source_url = EXCLUDED.source_url,
        title = COALESCE(EXCLUDED.title, brain_source_items.title),
        source_payload = EXCLUDED.source_payload,
        source_payload_hash = EXCLUDED.source_payload_hash,
        transcript_hash = EXCLUDED.transcript_hash,
        content_hash = EXCLUDED.content_hash,
        ingest_source_type = EXCLUDED.ingest_source_type,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = now()
      RETURNING id, source_kind, source_item_id
    `,
    [
      params.brainId,
      sourceKind,
      params.item.source_key,
      params.item.source_key,
      params.item.source_locator,
      params.item.title,
      JSON.stringify({
        source_type: params.item.source_type,
        metadata: params.item.metadata,
        source_identity_rule: sourceIdentityComment(params.item.source_type),
      }),
      payloadHash,
      params.item.content_hash,
      params.item.source_type,
      params.item.last_seen_at,
    ]
  );

  const sourceItem = inserted.rows[0];
  if (!sourceItem) throw new Error("Failed to upsert source item");
  return sourceItem;
}

async function fetchCurrentDocument(sourceItemId: string, documentKind: DocumentKind): Promise<CurrentDocumentRow | null> {
  const pool = getBrainLearningPool();
  const result = await pool.query<CurrentDocumentRow>(
    `
      SELECT id, content_sha256, version_no
      FROM brain_documents
      WHERE source_item_id = $1
        AND document_kind = $2
        AND is_current = TRUE
      LIMIT 1
    `,
    [sourceItemId, documentKind]
  );
  return result.rows[0] ?? null;
}

async function replaceChunks(params: {
  brainId: string;
  documentId: string;
  sourceItemId: string;
  runId: string;
  content: string;
}): Promise<number> {
  const pool = getBrainLearningPool();
  await pool.query(`DELETE FROM brain_chunks WHERE document_id = $1`, [params.documentId]);

  const chunks = chunkText(params.content);
  for (const chunk of chunks) {
    await pool.query(
      `
        INSERT INTO brain_chunks (
          brain_id,
          document_id,
          source_item_id,
          ingest_run_id,
          chunk_index,
          content_text,
          content_sha256,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          encode(digest($6, 'sha256'), 'hex'),
          $7::jsonb
        )
      `,
      [
        params.brainId,
        params.documentId,
        params.sourceItemId,
        params.runId,
        chunk.index,
        chunk.text,
        JSON.stringify({ chunking_strategy: "text_overlap" }),
      ]
    );
  }

  return chunks.length;
}

async function persistCreateOrVersion(params: {
  brainId: string;
  sourceItemId: string;
  runId: string;
  item: NormalizedIngestItem;
  documentKind: DocumentKind;
  current: CurrentDocumentRow | null;
}): Promise<{ documentId: string; versionNo: number; chunksCreated: number }> {
  const pool = getBrainLearningPool();
  const nextVersionNo = params.current ? params.current.version_no + 1 : 1;

  const inserted = await pool.query<{ id: string }>(
    `
      INSERT INTO brain_documents (
        brain_id,
        source_item_id,
        ingest_run_id,
        document_kind,
        content_text,
        content_json,
        token_count,
        content_sha256,
        version_no,
        freshness_score,
        is_current,
        supersedes_document_id,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8,
        $9,
        1.0000,
        TRUE,
        $10::uuid,
        $11::jsonb
      )
      RETURNING id
    `,
    [
      params.brainId,
      params.sourceItemId,
      params.runId,
      params.documentKind,
      params.item.content,
      JSON.stringify({ title: params.item.title, source_locator: params.item.source_locator }),
      params.item.content.length,
      params.item.content_hash,
      nextVersionNo,
      params.current?.id ?? null,
      JSON.stringify({ source_type: params.item.source_type }),
    ]
  );

  const documentId = inserted.rows[0]?.id;
  if (!documentId) throw new Error("Failed to create document");

  if (params.current?.id) {
    await pool.query(
      `
        UPDATE brain_documents
        SET is_current = FALSE,
            superseded_by_document_id = $2::uuid
        WHERE id = $1
      `,
      [params.current.id, documentId]
    );
  }

  const chunksCreated = await replaceChunks({
    brainId: params.brainId,
    documentId,
    sourceItemId: params.sourceItemId,
    runId: params.runId,
    content: params.item.content,
  });

  return { documentId, versionNo: nextVersionNo, chunksCreated };
}

async function persistUpdateInPlace(params: {
  brainId: string;
  sourceItemId: string;
  runId: string;
  item: NormalizedIngestItem;
  current: CurrentDocumentRow;
}): Promise<{ documentId: string; versionNo: number; chunksCreated: number }> {
  const pool = getBrainLearningPool();

  await pool.query(
    `
      UPDATE brain_documents
      SET ingest_run_id = $2,
          content_text = $3,
          content_json = $4::jsonb,
          token_count = $5,
          content_sha256 = $6,
          freshness_score = 1.0000,
          metadata = $7::jsonb
      WHERE id = $1
    `,
    [
      params.current.id,
      params.runId,
      params.item.content,
      JSON.stringify({ title: params.item.title, source_locator: params.item.source_locator }),
      params.item.content.length,
      params.item.content_hash,
      JSON.stringify({ source_type: params.item.source_type, updated_in_place: true }),
    ]
  );

  const chunksCreated = await replaceChunks({
    brainId: params.brainId,
    documentId: params.current.id,
    sourceItemId: params.sourceItemId,
    runId: params.runId,
    content: params.item.content,
  });

  return { documentId: params.current.id, versionNo: params.current.version_no, chunksCreated };
}

async function loadSourceTotals(brainId: string): Promise<Record<IngestSourceType, number>> {
  const pool = getBrainLearningPool();
  const result = await pool.query<{ source_type: IngestSourceType; count: string }>(
    `
      SELECT
        ingest_source_type AS source_type,
        COUNT(*)::text AS count
      FROM brain_source_items
      WHERE brain_id = $1
        AND ingest_source_type IN ('web_search', 'website_url', 'document_upload', 'youtube')
      GROUP BY ingest_source_type
    `,
    [brainId]
  );

  const out: Record<IngestSourceType, number> = {
    web_search: 0,
    website_url: 0,
    document_upload: 0,
    youtube: 0,
  };

  for (const row of result.rows) {
    out[row.source_type] = Number(row.count) || 0;
  }

  return out;
}

export async function runMultiSourceIngest(params: {
  brainId: string;
  sourceType: IngestSourceType;
  items: NormalizedIngestItem[];
}): Promise<MultiSourceIngestSummary> {
  const pool = getBrainLearningPool();

  const counters: IngestOutcomeCounter = {
    candidates_found: params.items.length,
    new_items_added: 0,
    duplicates_skipped: 0,
    updated_items: 0,
    versioned_items: 0,
    eligible_for_processing: 0,
    failed_items: 0,
  };

  const failures: Array<{ source_key: string; reason: string }> = [];

  for (const item of params.items) {
    try {
      const sourceItem = await upsertSourceItem({ brainId: params.brainId, item });
      const documentKind = mapDocumentKind(item.source_type);
      const current = await fetchCurrentDocument(sourceItem.id, documentKind);
      const decision = resolveDecision(item.source_type, current, item.content_hash);

      const runId = await createRun({
        brainId: params.brainId,
        sourceItemId: sourceItem.id,
        decision,
        sourceType: item.source_type,
        item,
      });

      if (decision === "skip") {
        counters.duplicates_skipped += 1;
        await pool.query(
          `
            UPDATE brain_source_items
            SET latest_ingest_run_id = $2,
                transcript_hash = $3,
                content_hash = $3,
                last_seen_at = $4::timestamptz,
                updated_at = now()
            WHERE id = $1
          `,
          [sourceItem.id, runId, item.content_hash, item.last_seen_at]
        );
        await updateRunStatus(runId, "skipped_duplicate", {
          dedupe_decision: decision,
          source_type: item.source_type,
          source_key: item.source_key,
          content_hash: item.content_hash,
          skip_reason: "content_unchanged",
        });
        continue;
      }

      counters.eligible_for_processing += 1;

      let persisted: { documentId: string; versionNo: number; chunksCreated: number };
      if (decision === "update" && current) {
        persisted = await persistUpdateInPlace({
          brainId: params.brainId,
          sourceItemId: sourceItem.id,
          runId,
          item,
          current,
        });
        counters.updated_items += 1;
      } else {
        persisted = await persistCreateOrVersion({
          brainId: params.brainId,
          sourceItemId: sourceItem.id,
          runId,
          item,
          documentKind,
          current,
        });
        if (decision === "create") counters.new_items_added += 1;
        if (decision === "version") counters.versioned_items += 1;
      }

      try {
        await runBrainTaxonomyEnrichment({
          brainId: params.brainId,
          sourceItemId: sourceItem.id,
          forceReclassify: decision !== "create",
          limit: 500,
        });
      } catch {
        // Non-blocking post-ingest enrichment.
      }

      await pool.query(
        `
          UPDATE brain_source_items
          SET latest_ingest_run_id = $2,
              transcript_hash = $3,
              content_hash = $3,
              last_seen_at = $4::timestamptz,
              updated_at = now()
          WHERE id = $1
        `,
        [sourceItem.id, runId, item.content_hash, item.last_seen_at]
      );

      await updateRunStatus(runId, "completed", {
        dedupe_decision: decision,
        source_type: item.source_type,
        source_key: item.source_key,
        content_hash: item.content_hash,
        document_id: persisted.documentId,
        document_version_no: persisted.versionNo,
        chunks_created: persisted.chunksCreated,
      });
    } catch (error) {
      counters.failed_items += 1;
      failures.push({
        source_key: item.source_key,
        reason: error instanceof Error ? error.message : "Unknown ingest failure",
      });
    }
  }

  return {
    brain_id: params.brainId,
    source_type: params.sourceType,
    ...counters,
    source_totals: await loadSourceTotals(params.brainId),
    failures,
  };
}
