import { getBrainLearningPool } from "@/lib/brain-learning/db";
import { runBrainTaxonomyEnrichment } from "@/lib/brain-learning/taxonomyEnrichment";
import { fetchYoutubeSourceText } from "@/lib/brain-learning/youtubeIngestSource";

type PendingRunRow = {
  run_id: string;
  source_item_id: string;
  source_kind: string;
  source_item_external_id: string;
  status: string;
  created_at: string;
};

type CurrentDocRow = {
  id: string;
  content_sha256: string | null;
  version_no: number;
};

type InsertDocRow = {
  id: string;
};

type ChunkDraft = {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
  startChar: number;
  endChar: number;
};

export type BrainIngestOrchestrationSummary = {
  brainId: string;
  sourceItemId: string | null;
  itemsConsidered: number;
  runsStarted: number;
  documentsCreated: number;
  chunksCreated: number;
  taxonomyChunksClassified: number;
  taxonomyAssignmentsCreated: number;
  taxonomyAssignmentsUpdated: number;
  itemsSkipped: number;
  failures: Array<{ runId: string; sourceItemId: string; reason: string }>;
};

function chunkTextWithOverlap(text: string, chunkSize = 1800, overlap = 200): ChunkDraft[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const chunks: ChunkDraft[] = [];
  let cursor = 0;
  let idx = 0;
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize);
    const chunkText = normalized.slice(cursor, end).trim();
    if (chunkText) {
      chunks.push({
        index: idx,
        text: chunkText,
        startMs: null,
        endMs: null,
        startChar: cursor,
        endChar: end,
      });
      idx += 1;
    }
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
}

function chunkFromSegments(
  segments: Array<{ text: string; startMs: number | null; endMs: number | null }>,
  chunkSize = 1800
): ChunkDraft[] {
  const filtered = segments.filter((s) => s.text && s.text.trim() !== "");
  if (!filtered.length) return [];
  const chunks: ChunkDraft[] = [];
  let idx = 0;
  let startChar = 0;
  let current: {
    texts: string[];
    startMs: number | null;
    endMs: number | null;
    charCount: number;
  } = {
    texts: [],
    startMs: null,
    endMs: null,
    charCount: 0,
  };

  const flush = () => {
    const text = current.texts.join(" ").trim();
    if (!text) return;
    const endChar = startChar + text.length;
    chunks.push({
      index: idx,
      text,
      startMs: current.startMs,
      endMs: current.endMs,
      startChar,
      endChar,
    });
    startChar = endChar + 1;
    idx += 1;
  };

  for (const seg of filtered) {
    const segText = seg.text.trim();
    if (!segText) continue;
    const projected = current.charCount + (current.texts.length > 0 ? 1 : 0) + segText.length;
    if (current.texts.length > 0 && projected > chunkSize) {
      flush();
      current = {
        texts: [],
        startMs: null,
        endMs: null,
        charCount: 0,
      };
    }
    current.texts.push(segText);
    current.charCount += (current.texts.length > 1 ? 1 : 0) + segText.length;
    if (current.startMs === null) current.startMs = seg.startMs;
    current.endMs = seg.endMs;
  }
  flush();
  return chunks;
}

async function updateRunStatus(
  runId: string,
  status: string,
  fields: {
    queuedAt?: boolean;
    startedAt?: boolean;
    completedAt?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const pool = getBrainLearningPool();
  const sets: string[] = ["status = $2", "updated_at = now()"];
  const values: unknown[] = [runId, status];
  let i = values.length + 1;

  if (fields.queuedAt) sets.push(`queued_at = now()`);
  if (fields.startedAt) sets.push(`started_at = now()`);
  if (fields.completedAt) sets.push(`completed_at = now()`);
  if (fields.errorCode !== undefined) {
    sets.push(`error_code = $${i++}`);
    values.push(fields.errorCode);
  }
  if (fields.errorMessage !== undefined) {
    sets.push(`error_message = $${i++}`);
    values.push(fields.errorMessage);
  }
  if (fields.metadata !== undefined) {
    sets.push(`metadata = $${i++}::jsonb`);
    values.push(JSON.stringify(fields.metadata));
  }

  await pool.query(
    `
      UPDATE brain_ingest_runs
      SET ${sets.join(", ")}
      WHERE id = $1
    `,
    values
  );
}

export async function runBrainIngestOrchestration(input: {
  brainId: string;
  sourceItemId?: string | null;
  limit?: number;
  forceReingest?: boolean;
}): Promise<BrainIngestOrchestrationSummary> {
  const pool = getBrainLearningPool();
  const sourceItemId = input.sourceItemId?.trim() || null;
  const maxItems = Math.max(1, Math.min(Number(input.limit || 20), 100));
  const forceReingest = Boolean(input.forceReingest);

  const summary: BrainIngestOrchestrationSummary = {
    brainId: input.brainId,
    sourceItemId,
    itemsConsidered: 0,
    runsStarted: 0,
    documentsCreated: 0,
    chunksCreated: 0,
    taxonomyChunksClassified: 0,
    taxonomyAssignmentsCreated: 0,
    taxonomyAssignmentsUpdated: 0,
    itemsSkipped: 0,
    failures: [],
  };

  const pending = await pool.query<PendingRunRow>(
    `
      SELECT
        r.id AS run_id,
        r.source_item_id,
        si.source_kind,
        si.source_item_id AS source_item_external_id,
        r.status,
        r.created_at
      FROM brain_ingest_runs r
      JOIN brain_source_items si ON si.id = r.source_item_id
      WHERE r.brain_id = $1
        AND ($2::uuid IS NULL OR r.source_item_id = $2::uuid)
        AND r.status IN ('discovered', 'reingest_requested')
      ORDER BY r.created_at ASC
      LIMIT $3
    `,
    [input.brainId, sourceItemId, maxItems]
  );

  summary.itemsConsidered = pending.rows.length;

  for (const row of pending.rows) {
    const runId = row.run_id;
    try {
      await updateRunStatus(runId, "queued", { queuedAt: true });
      await updateRunStatus(runId, "processing", { startedAt: true });
      summary.runsStarted += 1;

      if (row.source_kind !== "youtube_video") {
        await updateRunStatus(runId, "failed", {
          completedAt: true,
          errorCode: "UNSUPPORTED_SOURCE_KIND",
          errorMessage: `Unsupported source kind: ${row.source_kind}`,
        });
        summary.failures.push({
          runId,
          sourceItemId: row.source_item_id,
          reason: `Unsupported source kind: ${row.source_kind}`,
        });
        continue;
      }

      const existingCurrent = await pool.query<CurrentDocRow>(
        `
          SELECT id, content_sha256, version_no
          FROM brain_documents
          WHERE source_item_id = $1
            AND document_kind = 'transcript'
            AND is_current = TRUE
          LIMIT 1
        `,
        [row.source_item_id]
      );
      const current = existingCurrent.rows[0] || null;

      if (current && !forceReingest && row.status !== "reingest_requested") {
        await updateRunStatus(runId, "skipped_duplicate", {
          completedAt: true,
          metadata: {
            skip_reason: "current_document_exists",
            current_document_id: current.id,
          },
        });
        await pool.query(
          `UPDATE brain_source_items SET latest_ingest_run_id = $2, updated_at = now() WHERE id = $1`,
          [row.source_item_id, runId]
        );
        summary.itemsSkipped += 1;
        continue;
      }

      const sourceText = await fetchYoutubeSourceText(row.source_item_external_id);
      if (!sourceText.text.trim()) {
        throw new Error("Source-derived text was empty");
      }

      if (current && current.content_sha256 && current.content_sha256 === sourceText.contentSha256) {
        await updateRunStatus(runId, "skipped_duplicate", {
          completedAt: true,
          metadata: {
            skip_reason: "content_unchanged",
            current_document_id: current.id,
          },
        });
        await pool.query(
          `UPDATE brain_source_items SET latest_ingest_run_id = $2, transcript_hash = $3, updated_at = now() WHERE id = $1`,
          [row.source_item_id, runId, sourceText.contentSha256]
        );
        summary.itemsSkipped += 1;
        continue;
      }

      let nextVersion = 1;
      if (current) nextVersion = current.version_no + 1;

      const insertedDoc = await pool.query<InsertDocRow>(
        `
          INSERT INTO brain_documents (
            brain_id,
            source_item_id,
            ingest_run_id,
            document_kind,
            language_code,
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
            'transcript',
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
          input.brainId,
          row.source_item_id,
          runId,
          sourceText.languageCode,
          sourceText.text,
          JSON.stringify(sourceText.contentJson),
          sourceText.text.length,
          sourceText.contentSha256,
          nextVersion,
          current?.id || null,
          JSON.stringify({
            source_provider: "youtube",
            source_mode: sourceText.source,
          }),
        ]
      );
      const documentId = insertedDoc.rows[0]?.id;
      if (!documentId) {
        throw new Error("Failed to insert brain document");
      }
      summary.documentsCreated += 1;

      if (current) {
        await pool.query(
          `
            UPDATE brain_documents
            SET is_current = FALSE,
                superseded_by_document_id = $2::uuid
            WHERE id = $1
          `,
          [current.id, documentId]
        );
      }

      await pool.query(`DELETE FROM brain_chunks WHERE document_id = $1`, [documentId]);

      const chunks =
        sourceText.segments.length > 0
          ? chunkFromSegments(sourceText.segments)
          : chunkTextWithOverlap(sourceText.text);

      for (const chunk of chunks) {
        await pool.query(
          `
            INSERT INTO brain_chunks (
              brain_id,
              document_id,
              source_item_id,
              ingest_run_id,
              chunk_index,
              start_ms,
              end_ms,
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
              $7,
              $8,
              encode(digest($8, 'sha256'), 'hex'),
              $9::jsonb
            )
          `,
          [
            input.brainId,
            documentId,
            row.source_item_id,
            runId,
            chunk.index,
            chunk.startMs,
            chunk.endMs,
            chunk.text,
            JSON.stringify({
              start_char: chunk.startChar,
              end_char: chunk.endChar,
              chunking_strategy: sourceText.segments.length > 0 ? "segment_grouped" : "text_overlap",
            }),
          ]
        );
      }
      summary.chunksCreated += chunks.length;

      let taxonomySummary: {
        chunksClassified: number;
        assignmentsCreated: number;
        assignmentsUpdated: number;
      } = {
        chunksClassified: 0,
        assignmentsCreated: 0,
        assignmentsUpdated: 0,
      };
      try {
        const enrichment = await runBrainTaxonomyEnrichment({
          brainId: input.brainId,
          sourceItemId: row.source_item_id,
          forceReclassify: false,
          limit: 500,
        });
        taxonomySummary = {
          chunksClassified: enrichment.chunksClassified,
          assignmentsCreated: enrichment.assignmentsCreated,
          assignmentsUpdated: enrichment.assignmentsUpdated,
        };
      } catch {
        // Taxonomy enrichment should not fail core ingest persistence.
      }
      summary.taxonomyChunksClassified += taxonomySummary.chunksClassified;
      summary.taxonomyAssignmentsCreated += taxonomySummary.assignmentsCreated;
      summary.taxonomyAssignmentsUpdated += taxonomySummary.assignmentsUpdated;

      await pool.query(
        `
          UPDATE brain_source_items
          SET latest_ingest_run_id = $2,
              transcript_hash = $3,
              updated_at = now()
          WHERE id = $1
        `,
        [row.source_item_id, runId, sourceText.contentSha256]
      );

      await updateRunStatus(runId, "completed", {
        completedAt: true,
        metadata: {
          document_id: documentId,
          chunks_created: chunks.length,
          taxonomy_chunks_classified: taxonomySummary.chunksClassified,
          taxonomy_assignments_created: taxonomySummary.assignmentsCreated,
          taxonomy_assignments_updated: taxonomySummary.assignmentsUpdated,
          source_mode: sourceText.source,
          content_sha256: sourceText.contentSha256,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown ingest error";
      await updateRunStatus(runId, "failed", {
        completedAt: true,
        errorCode: "INGEST_ORCHESTRATION_FAILED",
        errorMessage: reason,
      });
      summary.failures.push({
        runId,
        sourceItemId: row.source_item_id,
        reason,
      });
    }
  }

  return summary;
}
