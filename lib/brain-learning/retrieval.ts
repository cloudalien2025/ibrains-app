import { getBrainLearningPool } from "@/lib/brain-learning/db";

type RetrievalRow = {
  chunk_id: string;
  document_id: string;
  source_item_id: string;
  ingest_run_id: string;
  brain_id: string;
  chunk_text: string;
  chunk_index: number;
  chunk_metadata: Record<string, unknown>;
  document_kind: string;
  document_version_no: number;
  document_is_current: boolean;
  document_freshness_score: string | number;
  document_supersedes_document_id: string | null;
  document_superseded_by_document_id: string | null;
  document_created_at: string;
  source_kind: string;
  source_external_id: string;
  source_title: string | null;
  source_url: string | null;
  source_publisher_name: string | null;
  source_published_at: string | null;
  source_payload: Record<string, unknown>;
  taxonomy_assignments: Array<{
    taxonomy_node_id: string;
    taxonomy_node_key: string;
    taxonomy_node_label: string;
    confidence: string | number | null;
    assigned_by: string;
    assignment_method: string | null;
    rationale: Record<string, unknown>;
  }>;
};

type ScoredCandidate = {
  row: RetrievalRow;
  lexicalScore: number;
  taxonomyScore: number;
  freshnessScore: number;
  currentnessScore: number;
  finalScore: number;
  matchedTerms: string[];
  taxonomyMatches: Array<{
    taxonomyNodeId: string;
    taxonomyNodeKey: string;
    taxonomyNodeLabel: string;
    confidence: number | null;
    assignedBy: string;
    assignmentMethod: string | null;
  }>;
};

export type BrainRetrievalItem = {
  chunkId: string;
  documentId: string;
  sourceItemId: string;
  ingestRunId: string;
  brainId: string;
  chunkText: string;
  relevanceScore: number;
  scoreBreakdown: {
    lexical: number;
    taxonomy: number;
    freshness: number;
    currentness: number;
  };
  freshness: {
    isCurrent: boolean;
    freshnessScore: number;
    versionNo: number;
    supersedesDocumentId: string | null;
    supersededByDocumentId: string | null;
    documentCreatedAt: string;
  };
  taxonomyMatches: Array<{
    taxonomyNodeId: string;
    taxonomyNodeKey: string;
    taxonomyNodeLabel: string;
    confidence: number | null;
    assignedBy: string;
    assignmentMethod: string | null;
  }>;
  provenance: {
    documentKind: string;
    chunkIndex: number;
    sourceKind: string;
    sourceExternalId: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    sourcePublisherName: string | null;
    sourcePublishedAt: string | null;
    sourcePayload: Record<string, unknown>;
    chunkMetadata: Record<string, unknown>;
  };
};

export type BrainRetrievalSummary = {
  brainId: string;
  query: string;
  limit: number;
  taxonomyNodeIds: string[];
  taxonomyNodeKeys: string[];
  queryTerms: string[];
  candidatesConsidered: number;
  returned: number;
  rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1";
  items: BrainRetrievalItem[];
};

const MAX_LIMIT = 50;
const MAX_CANDIDATES = 400;
const SOURCE_DIVERSITY_CAP = 2;
const DOCUMENT_DIVERSITY_CAP = 2;

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTokens(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  const out = new Set<string>();
  for (const token of normalized.split(" ")) {
    if (!token) continue;
    if (token.length >= 2) out.add(token);
    if (token.endsWith("s") && token.length > 4) out.add(token.slice(0, -1));
  }
  return [...out];
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreCandidate(
  row: RetrievalRow,
  query: string,
  queryTerms: string[],
  preferredNodeIds: Set<string>,
  preferredNodeKeys: Set<string>
): ScoredCandidate {
  const normalizedChunk = normalizeText(row.chunk_text);
  const normalizedTitle = normalizeText(row.source_title || "");
  const normalizedQuery = normalizeText(query);

  const matchedTerms = queryTerms.filter((term) => normalizedChunk.includes(term));
  const lexicalCoverage = queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0;
  const phraseInChunk = normalizedQuery && normalizedChunk.includes(normalizedQuery) ? 1 : 0;
  const phraseInTitle = normalizedQuery && normalizedTitle.includes(normalizedQuery) ? 1 : 0;
  const lexicalScore = Number((lexicalCoverage * 1.6 + phraseInChunk * 0.55 + phraseInTitle * 0.2).toFixed(6));

  const taxonomyMatches = (row.taxonomy_assignments || []).map((assignment) => ({
    taxonomyNodeId: assignment.taxonomy_node_id,
    taxonomyNodeKey: assignment.taxonomy_node_key,
    taxonomyNodeLabel: assignment.taxonomy_node_label,
    confidence: assignment.confidence === null ? null : Number(toNumber(assignment.confidence).toFixed(4)),
    assignedBy: assignment.assigned_by,
    assignmentMethod: assignment.assignment_method,
  }));

  const preferredMatches = taxonomyMatches.filter(
    (assignment) =>
      preferredNodeIds.has(assignment.taxonomyNodeId) || preferredNodeKeys.has(assignment.taxonomyNodeKey)
  );
  const strongestConfidence = taxonomyMatches.length
    ? Math.max(...taxonomyMatches.map((assignment) => toNumber(assignment.confidence)))
    : 0;
  const taxonomyScore = Number(
    (
      preferredMatches.length > 0
        ? 0.5 + Math.min(0.4, Math.max(...preferredMatches.map((m) => toNumber(m.confidence))) * 0.4)
        : strongestConfidence * 0.15
    ).toFixed(6)
  );

  const freshnessValue = Math.max(0, Math.min(1.5, toNumber(row.document_freshness_score)));
  const freshnessScore = Number((freshnessValue * 0.3).toFixed(6));
  const currentnessScore = Number((row.document_is_current ? 0.35 : -0.12).toFixed(6));

  const finalScore = Number((lexicalScore + taxonomyScore + freshnessScore + currentnessScore).toFixed(6));

  return {
    row,
    lexicalScore,
    taxonomyScore,
    freshnessScore,
    currentnessScore,
    finalScore,
    matchedTerms,
    taxonomyMatches,
  };
}

export async function runBrainRetrieval(input: {
  brainId: string;
  query: string;
  limit?: number;
  taxonomyNodeIds?: string[] | null;
  taxonomyNodeKeys?: string[] | null;
}): Promise<BrainRetrievalSummary> {
  const pool = getBrainLearningPool();
  const query = (input.query || "").trim();
  if (!query) throw new Error("Missing required field: query");

  const limit = Math.max(1, Math.min(Number(input.limit || 10), MAX_LIMIT));
  const taxonomyNodeIds = [...new Set((input.taxonomyNodeIds || []).map((id) => id.trim()).filter(Boolean))];
  const taxonomyNodeKeys = [...new Set((input.taxonomyNodeKeys || []).map((key) => key.trim()).filter(Boolean))];
  const queryTerms = uniqueTokens(query);

  const likeTerms = queryTerms.length ? queryTerms.map((term) => `%${term}%`) : [`%${query}%`];

  const candidates = await pool.query<RetrievalRow>(
    `
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.source_item_id,
        c.ingest_run_id,
        c.brain_id,
        c.content_text AS chunk_text,
        c.chunk_index,
        c.metadata AS chunk_metadata,
        d.document_kind,
        d.version_no AS document_version_no,
        d.is_current AS document_is_current,
        d.freshness_score AS document_freshness_score,
        d.supersedes_document_id AS document_supersedes_document_id,
        d.superseded_by_document_id AS document_superseded_by_document_id,
        d.created_at AS document_created_at,
        si.source_kind,
        si.source_item_id AS source_external_id,
        si.title AS source_title,
        si.source_url,
        si.publisher_name AS source_publisher_name,
        si.published_at AS source_published_at,
        si.source_payload,
        COALESCE(taxonomy.taxonomy_assignments, '[]'::jsonb) AS taxonomy_assignments
      FROM brain_chunks c
      JOIN brain_documents d ON d.id = c.document_id
      JOIN brain_source_items si ON si.id = c.source_item_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'taxonomy_node_id', a.taxonomy_node_id,
            'taxonomy_node_key', n.key,
            'taxonomy_node_label', n.label,
            'confidence', a.confidence,
            'assigned_by', a.assigned_by,
            'assignment_method', a.assignment_method,
            'rationale', a.rationale
          )
          ORDER BY a.confidence DESC NULLS LAST, n.key ASC
        ) AS taxonomy_assignments
        FROM brain_chunk_taxonomy_assignments a
        JOIN brain_taxonomy_nodes n
          ON n.id = a.taxonomy_node_id
         AND n.brain_id = c.brain_id
        WHERE a.chunk_id = c.id
          AND a.brain_id = c.brain_id
      ) taxonomy ON TRUE
      WHERE c.brain_id = $1
        AND (
          c.content_text ILIKE ANY($2::text[])
          OR COALESCE(si.title, '') ILIKE ANY($2::text[])
        )
        AND (
          cardinality($3::uuid[]) = 0
          OR EXISTS (
            SELECT 1
            FROM brain_chunk_taxonomy_assignments a2
            WHERE a2.chunk_id = c.id
              AND a2.brain_id = c.brain_id
              AND a2.taxonomy_node_id = ANY($3::uuid[])
          )
        )
        AND (
          cardinality($4::text[]) = 0
          OR EXISTS (
            SELECT 1
            FROM brain_chunk_taxonomy_assignments a3
            JOIN brain_taxonomy_nodes n3 ON n3.id = a3.taxonomy_node_id
            WHERE a3.chunk_id = c.id
              AND a3.brain_id = c.brain_id
              AND n3.key = ANY($4::text[])
          )
        )
      ORDER BY d.is_current DESC, d.freshness_score DESC, d.created_at DESC, c.chunk_index ASC
      LIMIT $5
    `,
    [input.brainId, likeTerms, taxonomyNodeIds, taxonomyNodeKeys, MAX_CANDIDATES]
  );

  const preferredNodeIds = new Set(taxonomyNodeIds);
  const preferredNodeKeys = new Set(taxonomyNodeKeys);
  const ranked = candidates.rows
    .map((row) => scoreCandidate(row, query, queryTerms, preferredNodeIds, preferredNodeKeys))
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.row.document_is_current !== a.row.document_is_current) {
        return b.row.document_is_current ? 1 : -1;
      }
      if (b.row.document_version_no !== a.row.document_version_no) {
        return b.row.document_version_no - a.row.document_version_no;
      }
      if (a.row.document_created_at !== b.row.document_created_at) {
        return b.row.document_created_at.localeCompare(a.row.document_created_at);
      }
      return a.row.chunk_id.localeCompare(b.row.chunk_id);
    });

  const sourceCounts = new Map<string, number>();
  const docCounts = new Map<string, number>();
  const picked: ScoredCandidate[] = [];
  for (const candidate of ranked) {
    if (picked.length >= limit) break;
    const sourceCount = sourceCounts.get(candidate.row.source_item_id) || 0;
    const docCount = docCounts.get(candidate.row.document_id) || 0;
    if (sourceCount >= SOURCE_DIVERSITY_CAP || docCount >= DOCUMENT_DIVERSITY_CAP) continue;
    picked.push(candidate);
    sourceCounts.set(candidate.row.source_item_id, sourceCount + 1);
    docCounts.set(candidate.row.document_id, docCount + 1);
  }

  const items: BrainRetrievalItem[] = picked.map((candidate) => ({
    chunkId: candidate.row.chunk_id,
    documentId: candidate.row.document_id,
    sourceItemId: candidate.row.source_item_id,
    ingestRunId: candidate.row.ingest_run_id,
    brainId: candidate.row.brain_id,
    chunkText: candidate.row.chunk_text,
    relevanceScore: candidate.finalScore,
    scoreBreakdown: {
      lexical: candidate.lexicalScore,
      taxonomy: candidate.taxonomyScore,
      freshness: candidate.freshnessScore,
      currentness: candidate.currentnessScore,
    },
    freshness: {
      isCurrent: candidate.row.document_is_current,
      freshnessScore: Number(toNumber(candidate.row.document_freshness_score).toFixed(4)),
      versionNo: candidate.row.document_version_no,
      supersedesDocumentId: candidate.row.document_supersedes_document_id,
      supersededByDocumentId: candidate.row.document_superseded_by_document_id,
      documentCreatedAt: candidate.row.document_created_at,
    },
    taxonomyMatches: candidate.taxonomyMatches,
    provenance: {
      documentKind: candidate.row.document_kind,
      chunkIndex: candidate.row.chunk_index,
      sourceKind: candidate.row.source_kind,
      sourceExternalId: candidate.row.source_external_id,
      sourceTitle: candidate.row.source_title,
      sourceUrl: candidate.row.source_url,
      sourcePublisherName: candidate.row.source_publisher_name,
      sourcePublishedAt: candidate.row.source_published_at,
      sourcePayload: candidate.row.source_payload || {},
      chunkMetadata: candidate.row.chunk_metadata || {},
    },
  }));

  return {
    brainId: input.brainId,
    query,
    limit,
    taxonomyNodeIds,
    taxonomyNodeKeys,
    queryTerms,
    candidatesConsidered: candidates.rows.length,
    returned: items.length,
    rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1",
    items,
  };
}
