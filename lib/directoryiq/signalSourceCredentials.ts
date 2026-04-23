export const DIRECTORYIQ_CONNECTORS = ["brilliant_directories_api", "openai", "serpapi", "ga4"] as const;

export type DirectoryIqConnector = (typeof DIRECTORYIQ_CONNECTORS)[number];

export type DirectoryIqCredentialStatus = {
  connector_id: DirectoryIqConnector;
  connected: boolean;
  label: string | null;
  masked_secret: string;
  updated_at: string | null;
  config: Record<string, string> | null;
};

export type DirectoryIqCredentialRow = {
  connector_id: string;
  label: string | null;
  secret_last4: string | null;
  secret_length: number | null;
  updated_at: string;
  config_json?: Record<string, unknown> | null;
};

export function isDirectoryIqConnector(value: string): value is DirectoryIqConnector {
  return (DIRECTORYIQ_CONNECTORS as readonly string[]).includes(value);
}

export function maskFromMetadata(last4: string | null, length: number | null): string {
  if (!length || length <= 0) return "Saved";
  const hidden = "*".repeat(Math.min(Math.max(length - 4, 0), 12));
  return `${hidden}${last4 ?? ""}` || "Saved";
}

function sanitizeConfig(config: Record<string, unknown> | null | undefined): Record<string, string> | null {
  if (!config || typeof config !== "object") return null;

  const entries = Object.entries(config).filter(
    (entry) => typeof entry[1] === "string" && entry[1].trim().length > 0
  ) as Array<[string, string]>;

  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

export function toDirectoryIqStatus(rows: DirectoryIqCredentialRow[]): DirectoryIqCredentialStatus[] {
  const map = new Map(rows.map((row) => [row.connector_id, row]));

  return DIRECTORYIQ_CONNECTORS.map((connector) => {
    const row = map.get(connector);
    return {
      connector_id: connector,
      connected: Boolean(row),
      label: row?.label ?? null,
      masked_secret: row ? maskFromMetadata(row.secret_last4 ?? null, row.secret_length ?? null) : "",
      updated_at: row?.updated_at ?? null,
      config: sanitizeConfig(row?.config_json),
    };
  });
}
