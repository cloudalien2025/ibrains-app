import { getBrainLearningPool } from "@/lib/brain-learning/db";
import { getTaxonomyTemplate, type TaxonomyTemplateNode } from "@/lib/brain-learning/taxonomyTemplates";

function buildNodePath(node: TaxonomyTemplateNode, byKey: Map<string, TaxonomyTemplateNode>): string {
  const segments = [node.key];
  let cursor = node;
  let guard = 0;
  while (cursor.parentKey && guard < 20) {
    const parent = byKey.get(cursor.parentKey);
    if (!parent) break;
    segments.unshift(parent.key);
    cursor = parent;
    guard += 1;
  }
  return segments.join("/");
}

function sortTemplateNodes(nodes: TaxonomyTemplateNode[]): TaxonomyTemplateNode[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const depth = (node: TaxonomyTemplateNode): number => {
    let d = 0;
    let cursor = node;
    let guard = 0;
    while (cursor.parentKey && guard < 20) {
      const parent = byKey.get(cursor.parentKey);
      if (!parent) break;
      d += 1;
      cursor = parent;
      guard += 1;
    }
    return d;
  };

  return [...nodes].sort((a, b) => {
    const depthDiff = depth(a) - depth(b);
    if (depthDiff !== 0) return depthDiff;
    return a.key.localeCompare(b.key);
  });
}

export async function ensureBrainTaxonomyNodes(input: {
  brainId: string;
  templateKey?: string | null;
}): Promise<{ templateKey: string; nodesCreated: number; nodesUpdated: number }> {
  const template = getTaxonomyTemplate(input.templateKey);
  const byKey = new Map(template.nodes.map((n) => [n.key, n]));
  const orderedNodes = sortTemplateNodes(template.nodes);
  const pool = getBrainLearningPool();

  let nodesCreated = 0;
  let nodesUpdated = 0;
  const idByKey = new Map<string, string>();

  for (const node of orderedNodes) {
    const parentNodeId = node.parentKey ? idByKey.get(node.parentKey) || null : null;
    const nodePath = buildNodePath(node, byKey);
    const result = await pool.query<{ id: string; inserted: boolean }>(
      `
        INSERT INTO brain_taxonomy_nodes (
          brain_id,
          key,
          label,
          description,
          parent_node_id,
          node_path,
          is_active,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::uuid,
          $6,
          TRUE,
          $7::jsonb,
          now(),
          now()
        )
        ON CONFLICT (brain_id, key)
        DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          parent_node_id = EXCLUDED.parent_node_id,
          node_path = EXCLUDED.node_path,
          is_active = TRUE,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING id, (xmax = 0) AS inserted
      `,
      [
        input.brainId,
        node.key,
        node.label,
        node.description || null,
        parentNodeId,
        nodePath,
        JSON.stringify({
          template_key: template.key,
          keywords: node.keywords || [],
        }),
      ]
    );

    const row = result.rows[0];
    if (!row) continue;
    idByKey.set(node.key, row.id);
    if (row.inserted) nodesCreated += 1;
    else nodesUpdated += 1;
  }

  return {
    templateKey: template.key,
    nodesCreated,
    nodesUpdated,
  };
}
