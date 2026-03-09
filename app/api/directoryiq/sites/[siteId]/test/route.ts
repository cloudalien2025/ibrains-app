export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { decryptBdSiteKey, getBdSite } from "@/app/api/directoryiq/_utils/bdSites";
import { normalizeBdBaseUrl } from "@/app/api/directoryiq/_utils/bdApi";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isSuccessWrapper(payload: Record<string, unknown> | null): boolean {
  const status = typeof payload?.status === "string" ? payload.status.toLowerCase() : null;
  return !status || status === "success";
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
}

function extractRows(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!payload) return [];
  const direct = [payload.message, payload.data, payload.items, payload.rows, payload.records];
  for (const candidate of direct) {
    const rows = asRows(candidate);
    if (rows.length > 0) return rows;
  }
  const nested = [payload.message, payload.data].filter(
    (candidate): candidate is Record<string, unknown> => !!candidate && typeof candidate === "object" && !Array.isArray(candidate)
  );
  for (const candidate of nested) {
    const rows = [candidate.items, candidate.rows, candidate.records, candidate.posts, candidate.data_posts];
    for (const rowCandidate of rows) {
      const parsed = asRows(rowCandidate);
      if (parsed.length > 0) return parsed;
    }
  }
  return [];
}

function hasListingLikeRow(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => {
    const hasGroupId = row.group_id != null;
    const hasListingField = Boolean(
      asString(row.group_name) ||
        asString(row.group_filename) ||
        asString(row.url) ||
        asString(row.title) ||
        asString(row.name)
    );
    return hasGroupId && hasListingField;
  });
}

function canonicalPostId(row: Record<string, unknown>): string {
  const value = row.post_id;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function hasBlogLikeRow(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => {
    const postId = canonicalPostId(row);
    if (!postId) return false;
    const hasTitle = Boolean(asString(row.post_title) || asString(row.title) || asString(row.name));
    const hasLocator = Boolean(
      asString(row.post_filename) ||
        asString(row.slug) ||
        asString(row.url) ||
        asString(row.link) ||
        asString(row.permalink)
    );
    return hasTitle || hasLocator;
  });
}

function collectDataPostsSearchPaths(preferredPath: string | null): string[] {
  const candidates = [
    preferredPath,
    "/api/v2/data_posts/search",
    "/api/v2/data_post/search",
    "/api/v2/posts/search",
    "/api/v2/data_posts/list",
  ];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizePath(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    paths.push(normalized);
  }
  return paths;
}

async function bdGet(baseUrl: string, apiKey: string, path: string) {
  const response = await fetch(`${normalizeBdBaseUrl(baseUrl)}${path}`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

async function bdPost(baseUrl: string, apiKey: string, path: string, form: Record<string, unknown>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value == null) continue;
    body.set(key, String(value));
  }
  const response = await fetch(`${normalizeBdBaseUrl(baseUrl)}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> | { siteId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { siteId } = await Promise.resolve(params);

    const site = await getBdSite(userId, siteId);
    if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!site.secret_ciphertext) return NextResponse.json({ error: "api_key_missing" }, { status: 400 });

    const apiKey = await decryptBdSiteKey(site);
    const listingsPath = asString(site.listings_path) || "/api/v2/users_portfolio_groups/search";

    let listings = {
      configured_data_id: site.listings_data_id ?? null,
      status: "unresolved",
      reason: site.listings_data_id ? null : "listings_data_id_missing",
      preflight: { ok: false, status: null as number | null, wrapper_status: null as string | null, data_type_observed: null as string | null },
      search: { ok: false, status: null as number | null, count: 0, path: listingsPath },
    };

    if (site.listings_data_id) {
      const preflight = await bdGet(site.base_url, apiKey, `/api/v2/data_categories/get/${site.listings_data_id}`);
      const preflightJson = preflight.json as Record<string, unknown> | null;
      const preflightStatus = typeof preflightJson?.status === "string" ? preflightJson.status : null;
      const preflightMessage = preflightJson?.message ?? null;
      const dataTypeObserved =
        (preflightMessage as Record<string, unknown> | undefined)?.data_type ??
        (preflightJson as Record<string, unknown> | undefined)?.data_type ??
        null;

      const search = await bdPost(site.base_url, apiKey, listingsPath, {
        action: "search",
        output_type: "array",
        data_id: site.listings_data_id,
        limit: 5,
        page: 1,
      });
      const searchJson = search.json as Record<string, unknown> | null;
      const searchRows = extractRows(searchJson);
      const listingLike = hasListingLikeRow(searchRows);

      const verified = preflight.ok && isSuccessWrapper(preflightJson) && search.ok && isSuccessWrapper(searchJson) && listingLike;

      listings = {
        configured_data_id: site.listings_data_id,
        status: verified ? "verified" : "unresolved",
        reason: verified ? null : "listings_data_id_unverified",
        preflight: {
          ok: preflight.ok,
          status: preflight.status,
          wrapper_status: preflightStatus,
          data_type_observed: typeof dataTypeObserved === "string" ? dataTypeObserved : null,
        },
        search: {
          ok: search.ok && isSuccessWrapper(searchJson),
          status: search.status,
          count: searchRows.length,
          path: listingsPath,
        },
      };
    }

    const blogSearchPaths = collectDataPostsSearchPaths(site.blog_posts_path);
    let blog = {
      configured_data_id: site.blog_posts_data_id ?? null,
      status: "unresolved",
      reason: (site.blog_posts_data_id ? "blog_posts_data_id_unverified" : "blog_posts_data_id_missing") as string | null,
      search: { ok: false, status: null as number | null, count: 0, path: blogSearchPaths[0] ?? null, tried_paths: blogSearchPaths },
    };

    if (site.blog_posts_data_id) {
      for (const path of blogSearchPaths) {
        const search = await bdPost(site.base_url, apiKey, path, {
          action: "search",
          output_type: "array",
          data_id: site.blog_posts_data_id,
          limit: 5,
          page: 1,
        });
        const searchJson = search.json as Record<string, unknown> | null;
        const rows = extractRows(searchJson);
        const verified = search.ok && isSuccessWrapper(searchJson) && hasBlogLikeRow(rows);
        if (verified) {
          blog = {
            configured_data_id: site.blog_posts_data_id,
            status: "verified",
            reason: null,
            search: { ok: true, status: search.status, count: rows.length, path, tried_paths: blogSearchPaths },
          };
          break;
        }

        blog = {
          configured_data_id: site.blog_posts_data_id,
          status: "unresolved",
          reason: "blog_posts_data_id_unverified",
          search: { ok: false, status: search.status, count: rows.length, path, tried_paths: blogSearchPaths },
        };
      }
    }

    return NextResponse.json({
      ok: listings.status === "verified" && blog.status === "verified",
      verification: {
        listings,
        blog_posts: blog,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD test error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
