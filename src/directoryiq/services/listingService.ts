import { ListingFacts } from "@/src/directoryiq/domain/types";
import { mapBdListingToFacts } from "@/src/directoryiq/adapters/bd/bdMapper";
import { queryDb } from "@/src/directoryiq/repositories/db";

type ListingRow = {
  source_id: string;
  title: string | null;
  url: string | null;
  raw_json: Record<string, unknown> | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function extractDescription(raw: Record<string, unknown>): string {
  return (
    asString(raw.group_desc) ||
    asString(raw.short_description) ||
    asString(raw.description) ||
    asString(raw.content) ||
    asString((raw.content as Record<string, unknown> | undefined)?.rendered) ||
    asString(raw.excerpt)
  );
}

export async function getListingFacts(userId: string, listingId: string): Promise<ListingFacts | null> {
  if (!process.env.DATABASE_URL) return null;

  const rows = await queryDb<ListingRow>(
    `
    SELECT source_id, title, url, raw_json
    FROM directoryiq_nodes
    WHERE user_id = $1 AND source_type = 'listing' AND source_id = $2
    LIMIT 1
    `,
    [userId, listingId]
  );

  const row = rows[0];
  if (!row) return null;

  const raw = (row.raw_json ?? {}) as Record<string, unknown>;
  const mapped = mapBdListingToFacts(row.source_id, raw);

  return {
    ...mapped,
    title: row.title ?? mapped.title,
    url: row.url ?? mapped.url,
    description: extractDescription(raw),
  };
}
