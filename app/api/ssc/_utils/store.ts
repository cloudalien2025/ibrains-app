import { Pool } from "pg";
import type {
  PromptPackRecord,
  PromptRecord,
  StoryboardRunRecord,
  StoryboardScoreRecord,
} from "./types";

export type ActivePromptPack = PromptPackRecord & {
  active: boolean;
  active_updated_at?: string | null;
};

export type ActivePromptResult = {
  pack: PromptPackRecord;
  prompt: PromptRecord;
};

export type StoryboardRunWithScores = StoryboardRunRecord & {
  scores: StoryboardScoreRecord[];
};

export interface SscStore {
  upsertPromptPack(pack: Omit<PromptPackRecord, "id">): Promise<string>;
  upsertPrompt(prompt: Omit<PromptRecord, "id">): Promise<string>;
  setActivePack(packName: string, packId: string): Promise<void>;
  listPromptPacks(): Promise<ActivePromptPack[]>;
  getPromptPackByName(packName: string): Promise<ActivePromptPack | null>;
  getActivePrompt(packName: string, dimension: string): Promise<ActivePromptResult | null>;
  createStoryboardRun(run: StoryboardRunRecord): Promise<void>;
  createStoryboardScore(score: StoryboardScoreRecord): Promise<void>;
  getLatestStoryboardRun(
    entityType: string,
    entityId: string
  ): Promise<StoryboardRunWithScores | null>;
}

let pool: Pool | null = null;
let loggedSelfSignedMode = false;

function shouldAllowSelfSignedDbSsl(connectionString: string): boolean {
  const explicitAllow =
    process.env.DATABASE_SSL_ALLOW_SELF_SIGNED === "1" ||
    process.env.PGSSLMODE === "no-verify";
  if (explicitAllow) return true;

  const isDev = process.env.NODE_ENV !== "production";
  const hasRequireMode = /sslmode=require/i.test(connectionString);
  return isDev && hasRequireMode;
}

function toNoVerifyConnectionString(connectionString: string): string {
  if (!/sslmode=/i.test(connectionString)) {
    const joiner = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${joiner}sslmode=no-verify`;
  }
  return connectionString.replace(/sslmode=([^&]+)/i, "sslmode=no-verify");
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not configured");
    }
    const allowSelfSigned = shouldAllowSelfSignedDbSsl(connectionString);
    if (allowSelfSigned && !loggedSelfSignedMode) {
      loggedSelfSignedMode = true;
      console.warn(
        "[db] Allowing self-signed PostgreSQL TLS certificate validation bypass (dev mode or DATABASE_SSL_ALLOW_SELF_SIGNED=1)."
      );
    }
    const resolvedConnectionString = allowSelfSigned
      ? toNoVerifyConnectionString(connectionString)
      : connectionString;
    pool = new Pool({
      connectionString: resolvedConnectionString,
      ssl: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = getPool();
  const result = await client.query(text, params);
  return result.rows as T[];
}

export class PgSscStore implements SscStore {
  async upsertPromptPack(pack: Omit<PromptPackRecord, "id">): Promise<string> {
    const rows = await query<{ id: string }>(
      `
      INSERT INTO ssc_prompt_packs
        (pack_name, version, build_date, sha256, canonicalization_rules)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (pack_name, version, sha256)
      DO UPDATE SET canonicalization_rules = EXCLUDED.canonicalization_rules
      RETURNING id
      `,
      [
        pack.pack_name,
        pack.version,
        pack.build_date,
        pack.sha256,
        JSON.stringify(pack.canonicalization_rules ?? []),
      ]
    );
    return rows[0]?.id;
  }

  async upsertPrompt(prompt: Omit<PromptRecord, "id">): Promise<string> {
    const rows = await query<{ id: string }>(
      `
      INSERT INTO ssc_prompts
        (pack_id, dimension, system_prompt, user_prompt, flags_vocabulary)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (pack_id, dimension)
      DO UPDATE SET
        system_prompt = EXCLUDED.system_prompt,
        user_prompt = EXCLUDED.user_prompt,
        flags_vocabulary = EXCLUDED.flags_vocabulary
      RETURNING id
      `,
      [
        prompt.pack_id,
        prompt.dimension,
        prompt.system_prompt,
        prompt.user_prompt,
        JSON.stringify(prompt.flags_vocabulary ?? []),
      ]
    );
    return rows[0]?.id;
  }

  async setActivePack(packName: string, packId: string): Promise<void> {
    await query(
      `
      INSERT INTO ssc_prompt_pack_active (pack_name, active_pack_id)
      VALUES ($1, $2)
      ON CONFLICT (pack_name)
      DO UPDATE SET active_pack_id = EXCLUDED.active_pack_id, updated_at = now()
      `,
      [packName, packId]
    );
  }

  async listPromptPacks(): Promise<ActivePromptPack[]> {
    const rows = await query<ActivePromptPack>(
      `
      SELECT
        p.id,
        p.pack_name,
        p.version,
        p.build_date,
        p.sha256,
        p.canonicalization_rules,
        p.created_at,
        (a.active_pack_id IS NOT NULL AND a.active_pack_id = p.id) AS active,
        a.updated_at AS active_updated_at
      FROM ssc_prompt_packs p
      LEFT JOIN ssc_prompt_pack_active a
        ON a.pack_name = p.pack_name
      ORDER BY p.pack_name, p.created_at DESC
      `
    );
    return rows.map((row) => ({
      ...row,
      canonicalization_rules: (row.canonicalization_rules ?? []) as string[],
    }));
  }

  async getPromptPackByName(packName: string): Promise<ActivePromptPack | null> {
    const rows = await query<ActivePromptPack>(
      `
      SELECT
        p.id,
        p.pack_name,
        p.version,
        p.build_date,
        p.sha256,
        p.canonicalization_rules,
        p.created_at,
        (a.active_pack_id IS NOT NULL AND a.active_pack_id = p.id) AS active,
        a.updated_at AS active_updated_at
      FROM ssc_prompt_packs p
      LEFT JOIN ssc_prompt_pack_active a
        ON a.pack_name = p.pack_name
      WHERE p.pack_name = $1
      ORDER BY p.created_at DESC
      LIMIT 1
      `,
      [packName]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      canonicalization_rules: (row.canonicalization_rules ?? []) as string[],
    };
  }

  async getActivePrompt(
    packName: string,
    dimension: string
  ): Promise<ActivePromptResult | null> {
    const rows = await query<{
      pack_id: string;
      pack_name: string;
      version: string;
      build_date: string;
      sha256: string;
      canonicalization_rules: string[];
      created_at?: string;
      dimension: string;
      system_prompt: string;
      user_prompt: string;
      flags_vocabulary: string[];
    }>(
      `
      SELECT
        p.id AS pack_id,
        p.pack_name,
        p.version,
        p.build_date,
        p.sha256,
        p.canonicalization_rules,
        p.created_at,
        pr.dimension,
        pr.system_prompt,
        pr.user_prompt,
        pr.flags_vocabulary
      FROM ssc_prompt_pack_active a
      JOIN ssc_prompt_packs p ON p.id = a.active_pack_id
      JOIN ssc_prompts pr ON pr.pack_id = p.id
      WHERE a.pack_name = $1 AND pr.dimension = $2
      LIMIT 1
      `,
      [packName, dimension]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      pack: {
        id: row.pack_id,
        pack_name: row.pack_name,
        version: row.version,
        build_date: row.build_date,
        sha256: row.sha256,
        canonicalization_rules: (row.canonicalization_rules ?? []) as string[],
        created_at: row.created_at,
      },
      prompt: {
        pack_id: row.pack_id,
        dimension: row.dimension,
        system_prompt: row.system_prompt,
        user_prompt: row.user_prompt,
        flags_vocabulary: (row.flags_vocabulary ?? []) as string[],
      },
    };
  }

  async createStoryboardRun(run: StoryboardRunRecord): Promise<void> {
    await query(
      `
      INSERT INTO ssc_storyboard_runs
        (id, entity_type, entity_id, url, screenshot_full_key, visible_text_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        run.id,
        run.entity_type,
        run.entity_id,
        run.url,
        run.screenshot_full_key,
        run.visible_text_key,
      ]
    );
  }

  async createStoryboardScore(score: StoryboardScoreRecord): Promise<void> {
    await query(
      `
      INSERT INTO ssc_storyboard_scores (id, run_id, dimension, score_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (run_id, dimension)
      DO UPDATE SET score_json = EXCLUDED.score_json
      `,
      [
        score.id ?? crypto.randomUUID(),
        score.run_id,
        score.dimension,
        JSON.stringify(score.score_json),
      ]
    );
  }

  async getLatestStoryboardRun(
    entityType: string,
    entityId: string
  ): Promise<StoryboardRunWithScores | null> {
    const runs = await query<StoryboardRunRecord>(
      `
      SELECT *
      FROM ssc_storyboard_runs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [entityType, entityId]
    );
    if (!runs[0]) return null;
    const run = runs[0];
    const scores = await query<StoryboardScoreRecord>(
      `
      SELECT *
      FROM ssc_storyboard_scores
      WHERE run_id = $1
      ORDER BY dimension ASC
      `,
      [run.id]
    );
    return { ...run, scores };
  }
}
