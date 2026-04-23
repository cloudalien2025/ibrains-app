import { queryDb } from "@/src/directoryiq/repositories/db";

type ListingRow = {
  source_id: string;
  title: string | null;
  url: string | null;
  raw_json: Record<string, unknown> | null;
};

function slugify(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readFromRaw(raw: Record<string, unknown> | null, keys: string[]): string {
  if (!raw) return "";
  for (const key of keys) {
    const value = readString(raw[key]);
    if (value) return value;
  }
  return "";
}

export function deriveHubKey(listing: ListingRow): {
  hubKey: string;
  categorySlug: string;
  geoSlug: string;
  topicSlug: string;
  title: string;
} {
  const raw = listing.raw_json ?? {};
  const category = readFromRaw(raw, ["category", "category_name", "listing_category", "primary_category", "industry", "industry_name"]);
  const city = readFromRaw(raw, ["city", "listing_city", "location_city"]);
  const region = readFromRaw(raw, ["state", "region", "listing_state", "location_state", "province"]);
  const topic = readFromRaw(raw, ["primary_service", "focus_topic", "service", "tagline"]);

  const categorySlug = slugify(category || listing.title || "general");
  const geoSlug = slugify([city, region].filter(Boolean).join(" ") || "global");
  const topicSlug = slugify(topic || category || listing.title || "general");
  const hubKey = `${categorySlug}::${geoSlug}::${topicSlug}`;
  const title = `${category || listing.title || "Category"} · ${city || region || "Global"}`;

  return { hubKey, categorySlug, geoSlug, topicSlug, title };
}

export async function upsertHubsForTenant(params: {
  tenantId: string;
  listingIds?: string[];
}): Promise<{ hubIds: string[] }> {
  const listings = await queryDb<ListingRow>(
    `
    SELECT source_id, title, url, raw_json
    FROM directoryiq_nodes
    WHERE source_type = 'listing'
      AND ($2::text[] IS NULL OR source_id = ANY($2))
    `,
    [params.tenantId, params.listingIds ?? null]
  );

  const hubIds: string[] = [];

  for (const listing of listings) {
    const derived = deriveHubKey(listing);
    const hubRows = await queryDb<{ id: string }>(
      `
      INSERT INTO directoryiq_hubs
        (tenant_id, hub_key, category_slug, geo_slug, topic_slug, title, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'hidden')
      ON CONFLICT (tenant_id, hub_key)
      DO UPDATE SET title = EXCLUDED.title, updated_at = now()
      RETURNING id
      `,
      [params.tenantId, derived.hubKey, derived.categorySlug, derived.geoSlug, derived.topicSlug, derived.title]
    );
    const hubId = hubRows[0]?.id;
    if (!hubId) continue;
    hubIds.push(hubId);

    await queryDb(
      `
      INSERT INTO directoryiq_hub_members
        (tenant_id, hub_id, member_type, member_id, member_url)
      VALUES ($1, $2, 'listing', $3, $4)
      ON CONFLICT (tenant_id, hub_id, member_type, member_id)
      DO NOTHING
      `,
      [params.tenantId, hubId, listing.source_id, listing.url]
    );

    await queryDb(
      `
      INSERT INTO directoryiq_hub_members
        (tenant_id, hub_id, member_type, member_id, member_url)
      SELECT DISTINCT $1, $2, 'blog', b.id::text, b.canonical_url
      FROM authority_graph_edges e
      JOIN authority_graph_nodes b ON b.id = e.from_node_id
      JOIN authority_graph_nodes l ON l.id = e.to_node_id
      WHERE e.tenant_id = $1
        AND l.external_id = $3
        AND b.node_type = 'blog_post'
      ON CONFLICT (tenant_id, hub_id, member_type, member_id)
      DO NOTHING
      `,
      [params.tenantId, hubId, listing.source_id]
    );
  }

  return { hubIds };
}

export async function computeHubMetrics(params: { tenantId: string; hubIds?: string[] }) {
  const rows = await queryDb<{
    hub_id: string;
    listing_count: number;
    blog_count: number;
    link_count: number;
  }>(
    `
    SELECT
      m.hub_id,
      COUNT(*) FILTER (WHERE m.member_type = 'listing') AS listing_count,
      COUNT(*) FILTER (WHERE m.member_type = 'blog') AS blog_count,
      COUNT(e.id) FILTER (WHERE e.edge_type IN ('internal_link','weak_anchor')) AS link_count
    FROM directoryiq_hub_members m
    LEFT JOIN authority_graph_nodes l ON l.external_id = m.member_id AND l.node_type = 'listing'
    LEFT JOIN authority_graph_edges e ON e.to_node_id = l.id AND e.tenant_id = m.tenant_id
    WHERE m.tenant_id = $1
      AND ($2::uuid[] IS NULL OR m.hub_id = ANY($2))
    GROUP BY m.hub_id
    `,
    [params.tenantId, params.hubIds ?? null]
  );

  for (const row of rows) {
    const possible = Math.max(1, row.listing_count * Math.max(1, row.blog_count));
    const hubLinkDensity = Math.round((row.link_count / possible) * 100);

    await queryDb(
      `
      INSERT INTO directoryiq_integrity_metrics
        (tenant_id, subject_type, subject_id, metrics_json, computed_at)
      VALUES ($1, 'hub', $2, $3::jsonb, now())
      ON CONFLICT (tenant_id, subject_type, subject_id)
      DO UPDATE SET metrics_json = EXCLUDED.metrics_json, computed_at = now()
      `,
      [
        params.tenantId,
        row.hub_id,
        JSON.stringify({
          listing_count: row.listing_count,
          blog_count: row.blog_count,
          hub_link_density: hubLinkDensity,
          hub_anchor_diversity: 0,
        }),
      ]
    );
  }
}
