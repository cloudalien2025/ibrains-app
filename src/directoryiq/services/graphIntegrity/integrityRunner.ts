import { queryDb } from "@/src/directoryiq/repositories/db";
import { enforceBacklinks } from "@/src/directoryiq/services/graphIntegrity/backlinkEnforcer";
import { computeBlogMetrics, computeListingMetrics, computeTenantSummary } from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";
import { computeHubMetrics, upsertHubsForTenant } from "@/src/directoryiq/services/graphIntegrity/hubModel";

export async function rebuildGraphIntegrity(params: {
  tenantId: string;
  userId: string;
  mode: "dry_run" | "apply";
}): Promise<{ updatedListings: number; updatedBlogs: number; warnings: string[] }> {
  const listings = await queryDb<{ external_id: string }>(
    `
    SELECT external_id
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'listing'
    `,
    [params.tenantId]
  );

  const blogs = await queryDb<{ id: string }>(
    `
    SELECT id
    FROM authority_graph_nodes
    WHERE tenant_id = $1 AND node_type = 'blog_post'
    `,
    [params.tenantId]
  );

  const backlinkResults = await enforceBacklinks({
    tenantId: params.tenantId,
    userId: params.userId,
    mode: params.mode,
  });

  for (const listing of listings) {
    await computeListingMetrics({ tenantId: params.tenantId, listingId: listing.external_id });
  }

  for (const blog of blogs) {
    await computeBlogMetrics({ tenantId: params.tenantId, blogIdOrSlug: blog.id });
  }

  const hubResult = await upsertHubsForTenant({ tenantId: params.tenantId });
  await computeHubMetrics({ tenantId: params.tenantId, hubIds: hubResult.hubIds });

  await computeTenantSummary({ tenantId: params.tenantId });

  return {
    updatedListings: listings.length,
    updatedBlogs: blogs.length,
    warnings: backlinkResults.warnings,
  };
}

export async function recomputeIntegrityDelta(params: {
  tenantId: string;
  userId: string;
  sinceMinutes?: number;
}): Promise<{ listings: string[]; blogs: string[] }> {
  const sinceMinutes = params.sinceMinutes ?? 60;
  const rows = await queryDb<{ listing_external_id: string; blog_node_id: string }>(
    `
    SELECT DISTINCT
      l.external_id AS listing_external_id,
      b.id AS blog_node_id
    FROM authority_graph_edges e
    JOIN authority_graph_nodes b ON b.id = e.from_node_id
    JOIN authority_graph_nodes l ON l.id = e.to_node_id
    WHERE e.tenant_id = $1
      AND e.last_seen_at >= now() - ($2::text || ' minutes')::interval
    `,
    [params.tenantId, String(sinceMinutes)]
  );

  const listingIds = Array.from(new Set(rows.map((row) => row.listing_external_id).filter(Boolean)));
  const blogIds = Array.from(new Set(rows.map((row) => row.blog_node_id).filter(Boolean)));

  for (const listingId of listingIds) {
    await computeListingMetrics({ tenantId: params.tenantId, listingId });
  }

  for (const blogId of blogIds) {
    await computeBlogMetrics({ tenantId: params.tenantId, blogIdOrSlug: blogId });
  }

  if (listingIds.length > 0) {
    const hubs = await upsertHubsForTenant({ tenantId: params.tenantId, listingIds });
    await computeHubMetrics({ tenantId: params.tenantId, hubIds: hubs.hubIds });
  }

  return { listings: listingIds, blogs: blogIds };
}
