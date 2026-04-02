import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@/lib/brain-learning/db", () => ({
  getBrainLearningPool: () => ({
    query: queryMock,
  }),
}));

describe("runBrainTaxonomyEnrichment", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("classifies unassigned chunks and stores method/confidence/provenance", async () => {
    const assignmentInserts: Array<{ confidence: number; method: string; rationale: string }> = [];

    queryMock.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("INSERT INTO brain_taxonomy_nodes")) {
        return { rows: [{ id: "node_seed", inserted: true }] };
      }
      if (
        sql.includes("SELECT id, key, label, description, node_path, metadata") &&
        sql.includes("FROM brain_taxonomy_nodes")
      ) {
        return {
          rows: [
            {
              id: "node_a",
              key: "metrics.performance",
              label: "Metrics & Performance",
              description: "Performance indicators and KPIs",
              node_path: "metrics.performance",
              metadata: { keywords: ["kpi", "conversion", "benchmark"] },
            },
            {
              id: "node_b",
              key: "operations.execution",
              label: "Operations & Execution",
              description: "Operational workflow details",
              node_path: "operations.execution",
              metadata: { keywords: ["workflow", "runbook"] },
            },
          ],
        };
      }
      if (sql.includes("FROM brain_chunks c") && sql.includes("LIMIT $6")) {
        return {
          rows: [
            {
              id: "chunk_1",
              document_id: "doc_1",
              source_item_id: "source_1",
              ingest_run_id: "run_1",
              content_text: "This video explains KPI benchmarks and conversion performance workflow.",
              taxonomy_hint: null,
            },
          ],
        };
      }
      if (sql.includes("SELECT taxonomy_node_id") && sql.includes("FROM brain_chunk_taxonomy_assignments")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO brain_chunk_taxonomy_assignments")) {
        assignmentInserts.push({
          confidence: Number(values?.[4] || 0),
          method: String(values?.[5] || ""),
          rationale: String(values?.[6] || ""),
        });
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM brain_chunk_taxonomy_assignments")) {
        return { rowCount: 0, rows: [] };
      }
      return { rows: [] };
    });

    const { runBrainTaxonomyEnrichment } = await import("@/lib/brain-learning/taxonomyEnrichment");
    const summary = await runBrainTaxonomyEnrichment({ brainId: "brain_1", limit: 10 });

    expect(summary.chunksConsidered).toBe(1);
    expect(summary.chunksClassified).toBe(1);
    expect(summary.assignmentsCreated).toBeGreaterThan(0);
    expect(summary.assignmentsUpdated).toBe(0);
    expect(summary.failures).toEqual([]);

    expect(assignmentInserts.length).toBeGreaterThan(0);
    expect(assignmentInserts[0].confidence).toBeGreaterThan(0.5);
    expect(assignmentInserts[0].method).toBe("deterministic_keyword_v1");
    expect(assignmentInserts[0].rationale).toContain("\"provenance\"");
    expect(assignmentInserts[0].rationale).toContain("\"chunk_id\":\"chunk_1\"");
  });

  it("force reclassify updates existing assignments and deletes stale rule edges", async () => {
    const deletes: unknown[][] = [];

    queryMock.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("INSERT INTO brain_taxonomy_nodes")) {
        return { rows: [{ id: "node_seed", inserted: false }] };
      }
      if (
        sql.includes("SELECT id, key, label, description, node_path, metadata") &&
        sql.includes("FROM brain_taxonomy_nodes")
      ) {
        return {
          rows: [
            {
              id: "node_a",
              key: "operations.execution",
              label: "Operations & Execution",
              description: "Operational workflow details",
              node_path: "operations.execution",
              metadata: { keywords: ["workflow"] },
            },
          ],
        };
      }
      if (sql.includes("FROM brain_chunks c") && sql.includes("LIMIT $6")) {
        return {
          rows: [
            {
              id: "chunk_2",
              document_id: "doc_2",
              source_item_id: "source_2",
              ingest_run_id: "run_2",
              content_text: "An operations workflow runbook.",
              taxonomy_hint: "workflow",
            },
          ],
        };
      }
      if (sql.includes("SELECT taxonomy_node_id") && sql.includes("FROM brain_chunk_taxonomy_assignments")) {
        return { rows: [{ taxonomy_node_id: "node_a" }, { taxonomy_node_id: "node_stale" }] };
      }
      if (sql.includes("INSERT INTO brain_chunk_taxonomy_assignments")) {
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM brain_chunk_taxonomy_assignments") && sql.includes("ANY($3::uuid[])")) {
        deletes.push(values as unknown[]);
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("DELETE FROM brain_chunk_taxonomy_assignments") && sql.includes("assigned_by = 'rule'")) {
        return { rowCount: 0, rows: [] };
      }
      return { rows: [] };
    });

    const { runBrainTaxonomyEnrichment } = await import("@/lib/brain-learning/taxonomyEnrichment");
    const summary = await runBrainTaxonomyEnrichment({
      brainId: "brain_2",
      forceReclassify: true,
      limit: 10,
    });

    expect(summary.chunksClassified).toBe(1);
    expect(summary.assignmentsCreated).toBe(0);
    expect(summary.assignmentsUpdated).toBe(1);
    expect(summary.assignmentsDeleted).toBe(1);
    expect(summary.failures).toEqual([]);

    expect(deletes.length).toBe(1);
    expect(JSON.stringify(deletes[0][2])).toContain("node_stale");
  });
});
