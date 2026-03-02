import { queryDb } from "@/src/directoryiq/repositories/db";
import { decryptSecret } from "@/src/directoryiq/repositories/secretCodec";

type IntegrationStatusRow = {
  provider: string;
  secret_ciphertext: string | null;
  meta_json: Record<string, unknown> | null;
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

export async function getIntegrationStatus(userId: string): Promise<IntegrationStatus> {
  const rows = await loadDirectoryIqIntegrationRows(userId);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  const openai = byProvider.get("openai");
  const bd = byProvider.get("brilliant_directories");

  return {
    openaiConfigured: Boolean(openai?.secret_ciphertext),
    bdConfigured: Boolean(bd?.secret_ciphertext && asString(bd.meta_json?.baseUrl ?? bd.meta_json?.base_url)),
  };
}

export async function getOpenAiKey(userId: string): Promise<string | null> {
  const rows = await loadDirectoryIqIntegrationRows(userId);
  const row = rows.find((item) => item.provider === "openai");
  if (!row?.secret_ciphertext) return process.env.OPENAI_API_KEY ?? null;
  return decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:openai`);
}

export async function getBdConnection(userId: string): Promise<BdConnection | null> {
  const rows = await loadDirectoryIqIntegrationRows(userId);
  const row = rows.find((item) => item.provider === "brilliant_directories");
  if (!row?.secret_ciphertext) return null;

  const meta = row.meta_json ?? {};
  const baseUrl = asString(meta.baseUrl ?? meta.base_url);
  if (!baseUrl) return null;

  const updatePath = asString(meta.dataPostsUpdatePath ?? meta.data_posts_update_path) || "/api/v2/data_posts/update";
  const apiKey = decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:brilliant_directories`);

  return {
    baseUrl,
    apiKey,
    updatePath,
  };
}
