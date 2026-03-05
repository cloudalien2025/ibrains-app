import { queryDb } from "@/src/directoryiq/repositories/db";
import { canonicalizeUrl } from "@/src/directoryiq/utils/canonicalizeUrl";
import {
  getDirectoryIqBdConnection,
  pushListingUpdateToBd,
  resolveTruePostIdForListing,
} from "@/app/api/directoryiq/_utils/integrations";
import { computeListingMetrics } from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";

const LINK_EDGE_TYPES = ["internal_link", "weak_anchor"] as const;

type BacklinkRequirement = {
  tenantId: string;
  listingId: string;
  listingTitle: string;
  listingUrl: string | null;
  listingRaw: Record<string, unknown> | null;
  blogNodeId: string;
  blogUrl: string;
  blogTitle: string | null;
};

type BacklinkResult = {
  listingId: string;
  blogUrl: string;
  status: "present" | "missing" | "unknown";
  note?: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractListingContent(raw: Record<string, unknown> | null): string {
  if (!raw) return "";
  const candidates = [
    raw.long_description,
    raw.description,
    raw.group_desc,
    raw.post_body,
    raw.post_content,
    raw.body_html,
    raw.content_html,
    raw.summary,
  ];
  for (const value of candidates) {
    const text = readString(value).trim();
    if (text) return text;
  }
  return "";
}

function buildBacklinkSnippet(blogTitle: string | null, blogUrl: string): string {
  const title = blogTitle?.trim() || blogUrl.split("/").filter(Boolean).pop() || blogUrl;
  return `\n<div class=\"directoryiq-backlinks\"><p><strong>Featured in:</strong> <a href=\"${blogUrl}\">${title}</a></p></div>`;
}

function hasBacklink(content: string, blogUrl: string): boolean {
  if (!content) return false;
  const canonical = canonicalizeUrl(blogUrl);
  if (!canonical) return false;
  return content.toLowerCase().includes(canonical);
}

async function loadListingRaw(listingId: string): Promise<Record<string, unknown> | null> {
  const rows = await queryDb<{ raw_json: Record<string, unknown> | null }>(
    `
    SELECT raw_json
    FROM directoryiq_nodes
    WHERE source_type = 'listing' AND source_id = $1
    LIMIT 1
    `,
    [listingId]
  );
  return rows[0]?.raw_json ?? null;
}

export async function computeBacklinkRequirements(tenantId: string): Promise<BacklinkRequirement[]> {
  const rows = await queryDb<{
    blog_node_id: string;
    blog_title: string | null;
    blog_url: string | null;
    listing_id: string;
    listing_title: string | null;
    listing_url: string | null;
  }>(
    `
    SELECT
      b.id AS blog_node_id,
      b.title AS blog_title,
      b.canonical_url AS blog_url,
      l.external_id AS listing_id,
      l.title AS listing_title,
      l.canonical_url AS listing_url
    FROM authority_graph_edges e
    JOIN authority_graph_nodes b ON b.id = e.from_node_id
    JOIN authority_graph_nodes l ON l.id = e.to_node_id
    WHERE e.tenant_id = $1
      AND e.edge_type = ANY($2)
      AND b.node_type = 'blog_post'
      AND l.node_type = 'listing'
    `,
    [tenantId, LINK_EDGE_TYPES]
  );

  const requirements: BacklinkRequirement[] = [];
  for (const row of rows) {
    if (!row.blog_url) continue;
    const raw = await loadListingRaw(row.listing_id);
    requirements.push({
      tenantId,
      listingId: row.listing_id,
      listingTitle: row.listing_title ?? row.listing_id,
      listingUrl: row.listing_url,
      listingRaw: raw,
      blogNodeId: row.blog_node_id,
      blogUrl: row.blog_url,
      blogTitle: row.blog_title,
    });
  }
  return requirements;
}

export async function checkBacklinkPresent(listingRaw: Record<string, unknown> | null, blogUrl: string): Promise<boolean> {
  const content = extractListingContent(listingRaw);
  return hasBacklink(content, blogUrl);
}

async function upsertBacklinkRecord(params: {
  tenantId: string;
  listingId: string;
  blogNodeId: string;
  blogUrl: string;
  status: "present" | "missing" | "unknown";
  evidence: Record<string, unknown>;
}): Promise<void> {
  await queryDb(
    `
    INSERT INTO directoryiq_listing_backlinks
      (tenant_id, listing_id, blog_node_id, blog_url, status, last_checked_at, evidence_json, updated_at)
    VALUES ($1, $2, $3, $4, $5, now(), $6::jsonb, now())
    ON CONFLICT (tenant_id, listing_id, blog_url)
    DO UPDATE SET
      blog_node_id = EXCLUDED.blog_node_id,
      status = EXCLUDED.status,
      last_checked_at = now(),
      evidence_json = EXCLUDED.evidence_json,
      updated_at = now()
    `,
    [params.tenantId, params.listingId, params.blogNodeId, params.blogUrl, params.status, JSON.stringify(params.evidence)]
  );
}

export async function enforceBacklinks(params: {
  tenantId: string;
  userId: string;
  mode: "dry_run" | "apply";
}): Promise<{
  results: BacklinkResult[];
  warnings: string[];
}> {
  const requirements = await computeBacklinkRequirements(params.tenantId);
  const warnings: string[] = [];
  const results: BacklinkResult[] = [];
  const touchedListings = new Set<string>();

  const connection = params.mode === "apply" ? await getDirectoryIqBdConnection(params.userId) : null;
  if (params.mode === "apply" && !connection) {
    warnings.push("bd_integration_missing");
  }

  for (const requirement of requirements) {
    const blogUrl = canonicalizeUrl(requirement.blogUrl);
    if (!blogUrl) continue;

    const present = await checkBacklinkPresent(requirement.listingRaw, blogUrl);
    if (present) {
      await upsertBacklinkRecord({
        tenantId: requirement.tenantId,
        listingId: requirement.listingId,
        blogNodeId: requirement.blogNodeId,
        blogUrl,
        status: "present",
        evidence: { detected: true },
      });
      touchedListings.add(requirement.listingId);
      results.push({ listingId: requirement.listingId, blogUrl, status: "present" });
      continue;
    }

    if (params.mode === "apply" && connection) {
      const slug = readString((requirement.listingRaw ?? {}).listing_slug ?? (requirement.listingRaw ?? {}).group_filename);
      const resolve = await resolveTruePostIdForListing({
        baseUrl: connection.baseUrl,
        apiKey: connection.apiKey,
        dataPostsSearchPath: connection.dataPostsSearchPath,
        listingsDataId: connection.listingsDataId,
        listingId: requirement.listingId,
        listingSlug: slug,
        listingTitle: requirement.listingTitle,
      });

      if (!resolve.truePostId) {
        await upsertBacklinkRecord({
          tenantId: requirement.tenantId,
          listingId: requirement.listingId,
          blogNodeId: requirement.blogNodeId,
          blogUrl,
          status: "missing",
          evidence: { reason: "listing_post_id_unresolved", mapping: resolve.mappingKey },
        });
        touchedListings.add(requirement.listingId);
        results.push({ listingId: requirement.listingId, blogUrl, status: "missing", note: "post_id_unresolved" });
        continue;
      }

      const currentContent = extractListingContent(requirement.listingRaw);
      const updatedContent = `${currentContent}${buildBacklinkSnippet(requirement.blogTitle, blogUrl)}`.trim();

      const push = await pushListingUpdateToBd({
        baseUrl: connection.baseUrl,
        apiKey: connection.apiKey,
        dataPostsUpdatePath: connection.dataPostsUpdatePath,
        postId: resolve.truePostId,
        changes: {
          post_body: updatedContent,
          group_desc: updatedContent,
        },
      });

      if (push.ok) {
        await upsertBacklinkRecord({
          tenantId: requirement.tenantId,
          listingId: requirement.listingId,
          blogNodeId: requirement.blogNodeId,
          blogUrl,
          status: "present",
          evidence: { updated: true, post_id: resolve.truePostId },
        });
        touchedListings.add(requirement.listingId);
        results.push({ listingId: requirement.listingId, blogUrl, status: "present", note: "updated" });
      } else {
        await upsertBacklinkRecord({
          tenantId: requirement.tenantId,
          listingId: requirement.listingId,
          blogNodeId: requirement.blogNodeId,
          blogUrl,
          status: "missing",
          evidence: { updated: false, status: push.status },
        });
        touchedListings.add(requirement.listingId);
        results.push({ listingId: requirement.listingId, blogUrl, status: "missing", note: "update_failed" });
      }
      continue;
    }

    await upsertBacklinkRecord({
      tenantId: requirement.tenantId,
      listingId: requirement.listingId,
      blogNodeId: requirement.blogNodeId,
      blogUrl,
      status: "missing",
      evidence: { mode: params.mode },
    });
    touchedListings.add(requirement.listingId);
    results.push({ listingId: requirement.listingId, blogUrl, status: "missing" });
  }

  for (const listingId of touchedListings) {
    await computeListingMetrics({ tenantId: params.tenantId, listingId });
  }

  return { results, warnings };
}
