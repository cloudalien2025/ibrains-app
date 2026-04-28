import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import {
  CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE,
  CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE,
  buildCasaHudCampaignFromOpportunity,
  CASAHUD_CAMPAIGN_METADATA_PHASE,
  parseCasaHudCampaignMetadata,
  toCasaHudCampaignMetadata,
  toCasaHudCampaignSummary,
  toCasaHudProjectVideoType,
  type CasaHudCampaign,
  type CasaHudCampaignStatus,
  type CasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

type CasaHudCampaignRow = {
  id: string;
  user_id: string;
  name: string;
  selected_title: string;
  video_type: string;
  status: string;
  provider_metadata: unknown;
  created_at: string;
  updated_at: string;
};

export function isCasaHudCampaignStoreUnavailable(error: unknown): boolean {
  return isUndefinedRelationError(error, "casahud_projects");
}

export async function isCasaHudCampaignStoreAvailable(): Promise<boolean> {
  try {
    const result = await query<{ projects: string | null }>(
      `
      SELECT to_regclass('public.casahud_projects')::text AS projects
      `,
    );
    return Boolean(result[0]?.projects);
  } catch {
    return false;
  }
}

function mapRowToCampaign(row: CasaHudCampaignRow): CasaHudCampaign | null {
  const parsed = parseCasaHudCampaignMetadata(row.provider_metadata);
  if (!parsed) return null;
  const stored = parsed.campaign;

  return {
    ...stored,
    id: row.id,
    name: row.name,
    selectedViralTitle: row.selected_title,
    status: row.status as CasaHudCampaignStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveCasaHudCampaign(userId: string, campaign: CasaHudCampaign): Promise<CasaHudCampaign> {
  const metadata = toCasaHudCampaignMetadata(campaign);

  await query(
    `
    INSERT INTO casahud_projects
    (id, user_id, name, selected_title, video_type, status, provider_metadata, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      selected_title = EXCLUDED.selected_title,
      video_type = EXCLUDED.video_type,
      status = EXCLUDED.status,
      provider_metadata = EXCLUDED.provider_metadata,
      updated_at = EXCLUDED.updated_at
    `,
    [
      campaign.id,
      userId,
      campaign.name,
      campaign.selectedViralTitle,
      toCasaHudProjectVideoType(campaign.campaignType),
      campaign.status,
      JSON.stringify(metadata),
      campaign.createdAt,
      campaign.updatedAt,
    ],
  );

  return campaign;
}

export async function createCasaHudCampaignFromOpportunity(
  userId: string,
  opportunity: CasaHudOpportunityResult,
): Promise<CasaHudCampaign> {
  const campaign = buildCasaHudCampaignFromOpportunity(userId, opportunity);
  return saveCasaHudCampaign(userId, campaign);
}

export async function listCasaHudCampaignSummaries(userId: string, limit = 12): Promise<CasaHudCampaignSummary[]> {
  const rows = await query<CasaHudCampaignRow>(
    `
    SELECT
      id,
      user_id,
      name,
      selected_title,
      video_type,
      status,
      provider_metadata,
      created_at,
      updated_at
    FROM casahud_projects
    WHERE user_id = $1
      AND provider_metadata->>'phase' IN ($2, $3, $4)
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $5
    `,
    [userId, CASAHUD_CAMPAIGN_METADATA_PHASE, CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE, CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE, limit],
  );

  return rows
    .map((row) => mapRowToCampaign(row))
    .filter((campaign): campaign is CasaHudCampaign => Boolean(campaign))
    .map((campaign) => toCasaHudCampaignSummary(campaign));
}

export async function getCasaHudCampaign(userId: string, campaignId: string): Promise<CasaHudCampaign | null> {
  const rows = await query<CasaHudCampaignRow>(
    `
    SELECT
      id,
      user_id,
      name,
      selected_title,
      video_type,
      status,
      provider_metadata,
      created_at,
      updated_at
    FROM casahud_projects
    WHERE user_id = $1
      AND id = $2
      AND provider_metadata->>'phase' IN ($3, $4, $5)
    LIMIT 1
    `,
    [
      userId,
      campaignId,
      CASAHUD_CAMPAIGN_METADATA_PHASE,
      CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE,
      CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE,
    ],
  );

  const row = rows[0];
  return row ? mapRowToCampaign(row) : null;
}
