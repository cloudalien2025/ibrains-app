import { queryDb } from "@/src/directoryiq/repositories/db";
import { decryptSecret } from "@/src/directoryiq/repositories/secretCodec";

type IntegrationStatusRow = {
  provider: string;
  secret_ciphertext: string | null;
  meta_json: Record<string, unknown> | null;
};

type BdSiteRow = {
  id: string;
  base_url: string;
  enabled: boolean;
  secret_ciphertext: string | null;
  listings_path: string | null;
  blog_posts_path: string | null;
  listings_data_id: number | null;
  blog_posts_data_id: number | null;
};

export type IntegrationStatus = {
  openaiConfigured: boolean;
  bdConfigured: boolean;
};

export type BdConnection = {
  baseUrl: string;
  apiKey: string;
  updatePath: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function loadDirectoryIqIntegrationRows(userId: string): Promise<IntegrationStatusRow[]> {
  if (!process.env.DATABASE_URL) return [];
  return queryDb<IntegrationStatusRow>(
    `
    SELECT provider, secret_ciphertext, meta_json
    FROM integrations_credentials
    WHERE user_id = $1 AND product = 'directoryiq'
    `,
    [userId]
  );
}

async function loadBdSites(userId: string): Promise<BdSiteRow[]> {
  if (!process.env.DATABASE_URL) return [];
  return queryDb<BdSiteRow>(
    `
    SELECT id, base_url, enabled, secret_ciphertext, listings_path, blog_posts_path, listings_data_id, blog_posts_data_id
    FROM directoryiq_bd_sites
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );
}

export async function getIntegrationStatus(userId: string): Promise<IntegrationStatus> {
  const [rows, bdSites] = await Promise.all([loadDirectoryIqIntegrationRows(userId), loadBdSites(userId)]);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  const openai = byProvider.get("openai");
  const bd = bdSites.find((site) => site.enabled && Boolean(site.secret_ciphertext) && asString(site.base_url));

  return {
    openaiConfigured: Boolean(openai?.secret_ciphertext),
    bdConfigured: Boolean(bd),
  };
}

export async function getOpenAiKey(userId: string): Promise<string | null> {
  const rows = await loadDirectoryIqIntegrationRows(userId);
  const row = rows.find((item) => item.provider === "openai");
  if (!row?.secret_ciphertext) return process.env.OPENAI_API_KEY ?? null;
  return decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:openai`);
}

export async function getBdConnection(userId: string, siteId?: string | null): Promise<BdConnection | null> {
  const sites = await loadBdSites(userId);
  const site = siteId
    ? sites.find((row) => row.id === siteId && row.enabled && Boolean(row.secret_ciphertext) && asString(row.base_url))
    : sites.find((row) => row.enabled && Boolean(row.secret_ciphertext) && asString(row.base_url));
  if (!site?.secret_ciphertext) return null;

  const baseUrl = asString(site.base_url);
  if (!baseUrl) return null;

  const updatePath = "/api/v2/data_posts/update";
  const apiKey = decryptSecret(site.secret_ciphertext, `${userId}:directoryiq:bd_site:${site.id}`);

  return {
    baseUrl,
    apiKey,
    updatePath,
  };
}
