import { query } from "@/app/api/ecomviper/_utils/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/app/api/ecomviper/_utils/crypto";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";
import type { NextRequest } from "next/server";

export type BdSiteRow = {
  id: string;
  user_id: string;
  label: string | null;
  base_url: string;
  enabled: boolean;
  listings_data_id: number | null;
  blog_posts_data_id: number | null;
  listings_path: string;
  blog_posts_path: string | null;
  ingest_checkpoint_json: Record<string, unknown> | null;
  secret_ciphertext: string | null;
  secret_last4: string | null;
  secret_length: number | null;
  created_at: string;
  updated_at: string;
};

export type BdSite = {
  id: string;
  userId: string;
  label: string | null;
  baseUrl: string;
  enabled: boolean;
  listingsDataId: number | null;
  blogPostsDataId: number | null;
  listingsPath: string;
  blogPostsPath: string | null;
  maskedSecret: string;
  secretPresent: boolean;
};

const DEFAULT_DIRECTORYIQ_USER_ID = "00000000-0000-4000-8000-000000000001";

export function isAdminRequest(req: NextRequest): boolean {
  const rawUserId = req.headers.get("x-user-id");
  if (rawUserId === "1") return true;
  const resolved = resolveUserId(req);
  return resolved === DEFAULT_DIRECTORYIQ_USER_ID;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\s+/g, "").replace(/\/+$/, "");
}

function secretContext(userId: string, siteId: string): string {
  return `${userId}:directoryiq:bd_site:${siteId}`;
}

export async function ensureLegacyBdSite(userId: string): Promise<void> {
  const existing = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM directoryiq_bd_sites WHERE user_id = $1`,
    [userId]
  );
  if ((existing[0]?.count ?? 0) > 0) return;

  const rows = await query<{
    id: string;
    user_id: string;
    secret_ciphertext: string | null;
    meta_json: Record<string, unknown> | null;
  }>(
    `
    SELECT id, user_id, secret_ciphertext, meta_json
    FROM integrations_credentials
    WHERE product = 'directoryiq' AND provider = 'brilliant_directories' AND user_id = $1
    ORDER BY saved_at DESC
    LIMIT 1
    `,
    [userId]
  );
  const legacy = rows[0];
  if (!legacy || !legacy.secret_ciphertext) return;
  const meta = legacy.meta_json ?? {};
  const baseUrlRaw =
    (typeof meta.baseUrl === "string" && meta.baseUrl.trim()) ||
    (typeof meta.base_url === "string" && meta.base_url.trim()) ||
    "";
  if (!baseUrlRaw) return;

  const listingsPath =
    (typeof meta.listingsPath === "string" && meta.listingsPath.trim()) ||
    (typeof meta.listings_path === "string" && meta.listings_path.trim()) ||
    "/api/v2/users_portfolio_groups/search";
  const blogPostsPath =
    (typeof meta.blogPostsPath === "string" && meta.blogPostsPath.trim()) ||
    (typeof meta.blog_posts_path === "string" && meta.blog_posts_path.trim()) ||
    null;
  const listingsDataId =
    typeof meta.listingsDataId === "number"
      ? meta.listingsDataId
      : typeof meta.listings_data_id === "number"
        ? meta.listings_data_id
        : null;
  const blogPostsDataId =
    typeof meta.blogPostsDataId === "number"
      ? meta.blogPostsDataId
      : typeof meta.blog_posts_data_id === "number"
        ? meta.blog_posts_data_id
        : null;
  const label = typeof meta.siteLabel === "string" ? meta.siteLabel : null;

  const decrypted = decryptSecret(legacy.secret_ciphertext, `${userId}:directoryiq:brilliant_directories`);
  const ciphertext = encryptSecret(decrypted, secretContext(userId, legacy.id));
  const secretLast4 = decrypted.slice(-4);

  await query(
    `
    INSERT INTO directoryiq_bd_sites
      (id, user_id, label, base_url, enabled, listings_data_id, blog_posts_data_id, listings_path, blog_posts_path, secret_ciphertext, secret_last4, secret_length)
    VALUES
      ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (user_id, base_url) DO NOTHING
    `,
    [
      legacy.id,
      userId,
      label,
      normalizeBaseUrl(baseUrlRaw),
      listingsDataId,
      blogPostsDataId,
      listingsPath,
      blogPostsPath,
      ciphertext,
      secretLast4,
      decrypted.length,
    ]
  );
}

export async function listBdSiteRows(userId: string): Promise<BdSiteRow[]> {
  await ensureLegacyBdSite(userId);
  return await query<BdSiteRow>(
    `
    SELECT id, user_id, label, base_url, enabled, listings_data_id, blog_posts_data_id, listings_path, blog_posts_path,
           ingest_checkpoint_json, secret_ciphertext, secret_last4, secret_length, created_at, updated_at
    FROM directoryiq_bd_sites
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );
}

export async function listBdSites(userId: string): Promise<BdSite[]> {
  const rows = await listBdSiteRows(userId);

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    label: row.label,
    baseUrl: row.base_url,
    enabled: row.enabled,
    listingsDataId: row.listings_data_id,
    blogPostsDataId: row.blog_posts_data_id,
    listingsPath: row.listings_path,
    blogPostsPath: row.blog_posts_path,
    maskedSecret: row.secret_last4 ? maskSecret(`XXXX${row.secret_last4}`) : "",
    secretPresent: Boolean(row.secret_ciphertext),
  }));
}

export async function getBdSite(userId: string, siteId: string): Promise<BdSiteRow | null> {
  const rows = await query<BdSiteRow>(
    `
    SELECT id, user_id, label, base_url, enabled, listings_data_id, blog_posts_data_id, listings_path, blog_posts_path,
           ingest_checkpoint_json, secret_ciphertext, secret_last4, secret_length, created_at, updated_at
    FROM directoryiq_bd_sites
    WHERE user_id = $1 AND id = $2
    LIMIT 1
    `,
    [userId, siteId]
  );
  return rows[0] ?? null;
}

export async function createBdSite(params: {
  userId: string;
  label: string | null;
  baseUrl: string;
  apiKey: string;
  listingsDataId: number | null;
  blogPostsDataId: number | null;
  listingsPath: string;
  blogPostsPath: string | null;
  enabled: boolean;
  limit: number;
}): Promise<BdSite> {
  const countRows = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM directoryiq_bd_sites WHERE user_id = $1`,
    [params.userId]
  );
  const count = countRows[0]?.count ?? 0;
  if (count >= params.limit) {
    throw new Error("bd_site_limit_reached");
  }

  const idRows = await query<{ id: string }>(
    `INSERT INTO directoryiq_bd_sites (user_id, label, base_url, enabled, listings_data_id, blog_posts_data_id, listings_path, blog_posts_path, secret_ciphertext, secret_last4, secret_length)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      params.userId,
      params.label,
      normalizeBaseUrl(params.baseUrl),
      params.enabled,
      params.listingsDataId,
      params.blogPostsDataId,
      params.listingsPath,
      params.blogPostsPath,
      "",
      null,
      params.apiKey.length,
    ]
  );
  const siteId = idRows[0].id;
  const ciphertext = encryptSecret(params.apiKey, secretContext(params.userId, siteId));
  const secretLast4 = params.apiKey.slice(-4);
  await query(
    `UPDATE directoryiq_bd_sites SET secret_ciphertext = $1, secret_last4 = $2, secret_length = $3 WHERE id = $4`,
    [ciphertext, secretLast4, params.apiKey.length, siteId]
  );

  return {
    id: siteId,
    userId: params.userId,
    label: params.label,
    baseUrl: normalizeBaseUrl(params.baseUrl),
    enabled: params.enabled,
    listingsDataId: params.listingsDataId,
    blogPostsDataId: params.blogPostsDataId,
    listingsPath: params.listingsPath,
    blogPostsPath: params.blogPostsPath,
    maskedSecret: maskSecret(params.apiKey),
    secretPresent: true,
  };
}

export async function updateBdSite(params: {
  userId: string;
  siteId: string;
  label: string | null;
  baseUrl: string;
  apiKey?: string | null;
  listingsDataId: number | null;
  blogPostsDataId: number | null;
  listingsPath: string;
  blogPostsPath: string | null;
  enabled: boolean;
}): Promise<void> {
  await query(
    `
    UPDATE directoryiq_bd_sites
    SET label = $3,
        base_url = $4,
        enabled = $5,
        listings_data_id = $6,
        blog_posts_data_id = $7,
        listings_path = $8,
        blog_posts_path = $9,
        updated_at = now()
    WHERE user_id = $1 AND id = $2
    `,
    [
      params.userId,
      params.siteId,
      params.label,
      normalizeBaseUrl(params.baseUrl),
      params.enabled,
      params.listingsDataId,
      params.blogPostsDataId,
      params.listingsPath,
      params.blogPostsPath,
    ]
  );
  if (params.apiKey && params.apiKey.trim().length > 0) {
    const cipher = encryptSecret(params.apiKey, secretContext(params.userId, params.siteId));
    await query(
      `UPDATE directoryiq_bd_sites SET secret_ciphertext = $1, secret_last4 = $2, secret_length = $3 WHERE id = $4`,
      [cipher, params.apiKey.slice(-4), params.apiKey.length, params.siteId]
    );
  }
}

export async function deleteBdSite(userId: string, siteId: string): Promise<void> {
  await query(`DELETE FROM directoryiq_bd_sites WHERE user_id = $1 AND id = $2`, [userId, siteId]);
}

export async function decryptBdSiteKey(site: BdSiteRow): Promise<string> {
  if (!site.secret_ciphertext) return "";
  return decryptSecret(site.secret_ciphertext, secretContext(site.user_id, site.id));
}

export function formatSiteResponse(site: BdSiteRow): BdSite {
  return {
    id: site.id,
    userId: site.user_id,
    label: site.label,
    baseUrl: site.base_url,
    enabled: site.enabled,
    listingsDataId: site.listings_data_id,
    blogPostsDataId: site.blog_posts_data_id,
    listingsPath: site.listings_path,
    blogPostsPath: site.blog_posts_path,
    maskedSecret: site.secret_last4 ? maskSecret(`XXXX${site.secret_last4}`) : "",
    secretPresent: Boolean(site.secret_ciphertext),
  };
}
