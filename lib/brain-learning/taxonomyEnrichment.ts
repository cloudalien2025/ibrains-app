import { getBrainLearningPool } from "@/lib/brain-learning/db";
import { ensureBrainTaxonomyNodes } from "@/lib/brain-learning/taxonomyBootstrap";

type TaxonomyNodeRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  node_path: string | null;
  metadata: Record<string, unknown>;
};

type ChunkRow = {
  id: string;
  document_id: string;
  source_item_id: string;
  ingest_run_id: string;
  content_text: string;
  taxonomy_hint: string | null;
};

type AssignmentRow = {
  taxonomy_node_id: string;
};

type ClassificationCandidate = {
  nodeId: string;
  nodeKey: string;
  confidence: number;
  matchedTerms: string[];
  score: number;
};

const ASSIGNMENT_METHOD = "deterministic_keyword_v1";

export type BrainTaxonomyEnrichmentSummary = {
  brainId: string;
  templateUsed: string;
  taxonomyNodesCreated: number;
  taxonomyNodesUpdated: number;
  chunksConsidered: number;
  chunksClassified: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsDeleted: number;
  failures: Array<{ chunkId: string; reason: string }>;
};

function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): Set<string> {
  const normalized = normalizeWord(text);
  if (!normalized) return new Set<string>();
  const raw = normalized.split(" ").filter(Boolean);
  const out = new Set<string>();
  for (const token of raw) {
    out.add(token);
    if (token.endsWith("s") && token.length > 4) {
      out.add(token.slice(0, -1));
    }
  }
  return out;
}

function scoreNodeMatch(chunkText: string, hintText: string, node: TaxonomyNodeRow): ClassificationCandidate | null {
  const chunkTokens = tokenize(`${chunkText} ${hintText}`);
  if (chunkTokens.size === 0) return null;

  const metadataKeywords = Array.isArray((node.metadata as any)?.keywords)
    ? ((node.metadata as any).keywords as unknown[]).filter((v) => typeof v === "string")
    : [];
  const phrasePool = [node.key, node.label, node.description || "", ...metadataKeywords].filter(Boolean);

  const matchedTerms = new Set<string>();
  let score = 0;

  for (const phrase of phrasePool) {
    const phraseTokens = [...tokenize(String(phrase))];
    if (!phraseTokens.length) continue;
    const overlap = phraseTokens.filter((token) => chunkTokens.has(token));
    if (!overlap.length) continue;

    const ratio = overlap.length / phraseTokens.length;
    let weight = 1;
    if (String(phrase) === node.label) weight = 1.6;
    else if (String(phrase) === node.key) weight = 1.4;
    else if (String(phrase) === node.description) weight = 1.2;

    score += ratio * weight;
    overlap.forEach((term) => matchedTerms.add(term));
  }

  if (score < 0.55) return null;
  const confidence = Math.min(0.99, 0.45 + score / 4);

  return {
    nodeId: node.id,
    nodeKey: node.key,
    confidence: Number(confidence.toFixed(4)),
    matchedTerms: [...matchedTerms].sort(),
    score,
  };
}

function classifyChunk(chunk: ChunkRow, taxonomyNodes: TaxonomyNodeRow[]): ClassificationCandidate[] {
  const candidates = taxonomyNodes
    .map((node) => scoreNodeMatch(chunk.content_text, chunk.taxonomy_hint || "", node))
    .filter((candidate): candidate is ClassificationCandidate => Boolean(candidate))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.nodeKey.localeCompare(b.nodeKey);
    });

  return candidates.slice(0, 3);
}

export async function runBrainTaxonomyEnrichment(input: {
  brainId: string;
  sourceItemId?: string | null;
  documentId?: string | null;
  chunkId?: string | null;
  limit?: number;
  forceReclassify?: boolean;
  bootstrapTemplateKey?: string | null;
}): Promise<BrainTaxonomyEnrichmentSummary> {
  const pool = getBrainLearningPool();
  const sourceItemId = input.sourceItemId?.trim() || null;
  const documentId = input.documentId?.trim() || null;
  const chunkId = input.chunkId?.trim() || null;
  const maxItems = Math.max(1, Math.min(Number(input.limit || 100), 500));
  const forceReclassify = Boolean(input.forceReclassify);

  const taxonomySeed = await ensureBrainTaxonomyNodes({
    brainId: input.brainId,
    templateKey: input.bootstrapTemplateKey || null,
  });

  const taxonomyNodesResult = await pool.query<TaxonomyNodeRow>(
    `
      SELECT id, key, label, description, node_path, metadata
      FROM brain_taxonomy_nodes
      WHERE brain_id = $1
        AND is_active = TRUE
      ORDER BY node_path ASC NULLS LAST, key ASC
    `,
    [input.brainId]
  );

  const taxonomyNodes = taxonomyNodesResult.rows;
  if (taxonomyNodes.length === 0) {
    throw new Error("No active taxonomy nodes available for brain");
  }

  const chunksResult = await pool.query<ChunkRow>(
    `
      SELECT
        c.id,
        c.document_id,
        c.source_item_id,
        c.ingest_run_id,
        c.content_text,
        c.taxonomy_hint
      FROM brain_chunks c
      LEFT JOIN (
        SELECT chunk_id, COUNT(*) AS assignment_count
        FROM brain_chunk_taxonomy_assignments
        WHERE brain_id = $1
        GROUP BY chunk_id
      ) existing ON existing.chunk_id = c.id
      WHERE c.brain_id = $1
        AND ($2::uuid IS NULL OR c.source_item_id = $2::uuid)
        AND ($3::uuid IS NULL OR c.document_id = $3::uuid)
        AND ($4::uuid IS NULL OR c.id = $4::uuid)
        AND ($5::boolean IS TRUE OR COALESCE(existing.assignment_count, 0) = 0)
      ORDER BY c.created_at ASC, c.chunk_index ASC
      LIMIT $6
    `,
    [input.brainId, sourceItemId, documentId, chunkId, forceReclassify, maxItems]
  );

  const summary: BrainTaxonomyEnrichmentSummary = {
    brainId: input.brainId,
    templateUsed: taxonomySeed.templateKey,
    taxonomyNodesCreated: taxonomySeed.nodesCreated,
    taxonomyNodesUpdated: taxonomySeed.nodesUpdated,
    chunksConsidered: chunksResult.rows.length,
    chunksClassified: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    assignmentsDeleted: 0,
    failures: [],
  };

  for (const chunk of chunksResult.rows) {
    try {
      const classification = classifyChunk(chunk, taxonomyNodes);
      if (classification.length === 0) {
        if (forceReclassify) {
          const ruleAssignments = await pool.query<{ taxonomy_node_id: string }>(
            `
              SELECT taxonomy_node_id
              FROM brain_chunk_taxonomy_assignments
              WHERE brain_id = $1
                AND chunk_id = $2
                AND assigned_by = 'rule'
            `,
            [input.brainId, chunk.id]
          );
          const deleted = await pool.query(
            `
              DELETE FROM brain_chunk_taxonomy_assignments
              WHERE brain_id = $1
                AND chunk_id = $2
                AND assigned_by = 'rule'
            `,
            [input.brainId, chunk.id]
          );
          if (deleted) summary.assignmentsDeleted += ruleAssignments.rows.length;
        }
        continue;
      }

      const existingRows = await pool.query<AssignmentRow>(
        `
          SELECT taxonomy_node_id
          FROM brain_chunk_taxonomy_assignments
          WHERE brain_id = $1
            AND chunk_id = $2
        `,
        [input.brainId, chunk.id]
      );
      const existingNodeIds = new Set(existingRows.rows.map((row) => row.taxonomy_node_id));
      const classifiedNodeIds = classification.map((item) => item.nodeId);

      for (const item of classification) {
        const metadata = {
          classifier_version: ASSIGNMENT_METHOD,
          assignment_method: ASSIGNMENT_METHOD,
          node_key: item.nodeKey,
          matched_terms: item.matchedTerms,
          score: Number(item.score.toFixed(6)),
          provenance: {
            brain_id: input.brainId,
            source_item_id: chunk.source_item_id,
            ingest_run_id: chunk.ingest_run_id,
            document_id: chunk.document_id,
            chunk_id: chunk.id,
          },
        };

        await pool.query(
          `
            INSERT INTO brain_chunk_taxonomy_assignments (
              brain_id,
              chunk_id,
              taxonomy_node_id,
              ingest_run_id,
              confidence,
              assigned_by,
              assignment_method,
              rationale,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              'rule',
              $6,
              $7::jsonb,
              now(),
              now()
            )
            ON CONFLICT (chunk_id, taxonomy_node_id)
            DO UPDATE SET
              ingest_run_id = EXCLUDED.ingest_run_id,
              confidence = EXCLUDED.confidence,
              assigned_by = EXCLUDED.assigned_by,
              assignment_method = EXCLUDED.assignment_method,
              rationale = EXCLUDED.rationale,
              updated_at = now()
          `,
          [
            input.brainId,
            chunk.id,
            item.nodeId,
            chunk.ingest_run_id,
            item.confidence,
            ASSIGNMENT_METHOD,
            JSON.stringify(metadata),
          ]
        );

        if (existingNodeIds.has(item.nodeId)) summary.assignmentsUpdated += 1;
        else summary.assignmentsCreated += 1;
      }

      if (forceReclassify) {
        const staleNodeIds = [...existingNodeIds].filter((nodeId) => !classifiedNodeIds.includes(nodeId));
        if (staleNodeIds.length > 0) {
          const deleted = await pool.query(
            `
              DELETE FROM brain_chunk_taxonomy_assignments
              WHERE brain_id = $1
                AND chunk_id = $2
                AND assigned_by = 'rule'
                AND taxonomy_node_id = ANY($3::uuid[])
            `,
            [input.brainId, chunk.id, staleNodeIds]
          );
          if (deleted) summary.assignmentsDeleted += staleNodeIds.length;
        }
      }

      summary.chunksClassified += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown taxonomy enrichment error";
      summary.failures.push({
        chunkId: chunk.id,
        reason,
      });
    }
  }

  return summary;
}
