import { getBrainLearningPool } from "@/lib/brain-learning/db";
import {
  discoverYoutubeVideos,
  stableJsonHash,
  type YoutubeWatchMode,
} from "@/lib/brain-learning/youtubeDiscovery";

type WatchRow = {
  id: string;
  source_kind: YoutubeWatchMode;
  external_ref: string;
  canonical_ref: string;
  discovery_query: string | null;
  config: Record<string, unknown>;
};

type UpsertRow = {
  id: string;
  inserted: boolean;
};

function maxResultsFromConfig(config: Record<string, unknown>): number {
  const raw = Number(config.max_results ?? process.env.BRAIN_DISCOVERY_DEFAULT_MAX_RESULTS ?? 25);
  if (Number.isNaN(raw)) return 25;
  return Math.max(1, Math.min(raw, 50));
}

export type YoutubeWatchDiscoverySummary = {
  brainId: string;
  watchId: string | null;
  watchesProcessed: number;
  candidatesSeen: number;
  newItemsInserted: number;
  existingItemsMatched: number;
  ingestRunsCreated: number;
  failures: Array<{ watchId: string; reason: string }>;
};

export async function runYoutubeWatchDiscovery(input: {
  brainId: string;
  watchId?: string | null;
  dryRun?: boolean;
}): Promise<YoutubeWatchDiscoverySummary> {
  const pool = getBrainLearningPool();
  const watchId = input.watchId?.trim() || null;
  const dryRun = Boolean(input.dryRun);

  const summary: YoutubeWatchDiscoverySummary = {
    brainId: input.brainId,
    watchId,
    watchesProcessed: 0,
    candidatesSeen: 0,
    newItemsInserted: 0,
    existingItemsMatched: 0,
    ingestRunsCreated: 0,
    failures: [],
  };

  const watchesQuery = watchId
    ? `
      SELECT id, source_kind, external_ref, canonical_ref, discovery_query, config
      FROM brain_source_watches
      WHERE brain_id = $1
        AND is_active = TRUE
        AND id = $2
        AND source_kind IN ('youtube_channel', 'youtube_playlist', 'youtube_keyword')
      ORDER BY priority ASC, created_at ASC
    `
    : `
      SELECT id, source_kind, external_ref, canonical_ref, discovery_query, config
      FROM brain_source_watches
      WHERE brain_id = $1
        AND is_active = TRUE
        AND source_kind IN ('youtube_channel', 'youtube_playlist', 'youtube_keyword')
      ORDER BY priority ASC, created_at ASC
    `;

  const watchesResult = watchId
    ? await pool.query<WatchRow>(watchesQuery, [input.brainId, watchId])
    : await pool.query<WatchRow>(watchesQuery, [input.brainId]);

  for (const watch of watchesResult.rows) {
    summary.watchesProcessed += 1;
    try {
      const candidates = await discoverYoutubeVideos({
        mode: watch.source_kind,
        externalRef: watch.external_ref,
        canonicalRef: watch.canonical_ref,
        discoveryQuery: watch.discovery_query,
        maxResults: maxResultsFromConfig(watch.config || {}),
      });

      const deduped = new Map<string, (typeof candidates)[number]>();
      for (const candidate of candidates) {
        if (!deduped.has(candidate.canonicalIdentity)) {
          deduped.set(candidate.canonicalIdentity, candidate);
        }
      }

      summary.candidatesSeen += deduped.size;
      if (!dryRun) {
        for (const candidate of deduped.values()) {
          const payload = {
            provider: "youtube",
            channel_id: candidate.channelId,
            channel_title: candidate.channelTitle,
            discovered_from_watch_id: watch.id,
            discovery_mode: watch.source_kind,
            raw: candidate.raw,
          };
          const sourcePayloadHash = stableJsonHash(payload);

          const upsert = await pool.query<UpsertRow>(
            `
              INSERT INTO brain_source_items (
                brain_id,
                source_watch_id,
                source_kind,
                source_item_id,
                canonical_identity,
                source_url,
                title,
                publisher_name,
                language_code,
                published_at,
                discovered_at,
                source_payload,
                source_payload_hash,
                updated_at
              )
              VALUES (
                $1,
                $2,
                'youtube_video',
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::timestamptz,
                now(),
                $10::jsonb,
                $11,
                now()
              )
              ON CONFLICT (brain_id, source_kind, canonical_identity)
              DO UPDATE SET
                source_watch_id = EXCLUDED.source_watch_id,
                source_item_id = EXCLUDED.source_item_id,
                source_url = COALESCE(EXCLUDED.source_url, brain_source_items.source_url),
                title = COALESCE(EXCLUDED.title, brain_source_items.title),
                publisher_name = COALESCE(EXCLUDED.publisher_name, brain_source_items.publisher_name),
                language_code = COALESCE(EXCLUDED.language_code, brain_source_items.language_code),
                published_at = COALESCE(EXCLUDED.published_at, brain_source_items.published_at),
                source_payload = EXCLUDED.source_payload,
                source_payload_hash = EXCLUDED.source_payload_hash,
                updated_at = now()
              RETURNING id, (xmax = 0) AS inserted
            `,
            [
              input.brainId,
              watch.id,
              candidate.sourceItemId,
              candidate.canonicalIdentity,
              candidate.sourceUrl,
              candidate.title,
              candidate.channelTitle,
              candidate.languageCode,
              candidate.publishedAt,
              JSON.stringify(payload),
              sourcePayloadHash,
            ]
          );

          const row = upsert.rows[0];
          if (!row) continue;
          if (row.inserted) {
            summary.newItemsInserted += 1;
            await pool.query(
              `
                INSERT INTO brain_ingest_runs (
                  brain_id,
                  source_item_id,
                  status,
                  trigger_type,
                  ingest_reason,
                  attempt_no,
                  queued_at,
                  metadata
                )
                VALUES (
                  $1,
                  $2,
                  'discovered',
                  'watch_poll',
                  'youtube_watch_discovery',
                  1,
                  now(),
                  $3::jsonb
                )
              `,
              [
                input.brainId,
                row.id,
                JSON.stringify({
                  watch_id: watch.id,
                  discovery_mode: watch.source_kind,
                }),
              ]
            );
            summary.ingestRunsCreated += 1;
          } else {
            summary.existingItemsMatched += 1;
          }
        }

        await pool.query(
          `UPDATE brain_source_watches SET last_checked_at = now(), updated_at = now() WHERE id = $1`,
          [watch.id]
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown discovery error";
      summary.failures.push({ watchId: watch.id, reason: message });
    }
  }

  return summary;
}
