import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { CasaHudProductionRepository } from "@/lib/studio/domara/ai-channel-engine/repository";
import type {
  CasaHudGenerationRun,
  CasaHudOrchestratorOutput,
  CasaHudProject,
  CasaHudStageRecord,
} from "@/lib/studio/domara/ai-channel-engine/types";

export function isCasaHudStoreUnavailable(error: unknown): boolean {
  return (
    isUndefinedRelationError(error, "casahud_generation_runs") ||
    isUndefinedRelationError(error, "casahud_projects") ||
    isUndefinedRelationError(error, "casahud_run_outputs")
  );
}

export async function isCasaHudStoreAvailable(): Promise<boolean> {
  try {
    const result = await query<{ generation_runs: string | null; run_outputs: string | null }>(
      `
      SELECT
        to_regclass('public.casahud_generation_runs')::text as generation_runs,
        to_regclass('public.casahud_run_outputs')::text as run_outputs
      `,
    );
    return Boolean(result[0]?.generation_runs && result[0]?.run_outputs);
  } catch {
    return false;
  }
}

export type CasaHudRunSummaryRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  status: string;
  objective: string;
  current_stage: string;
  selected_title: string | null;
  project_name: string | null;
  video_type: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCasaHudRunSummaries(userId: string, limit = 12): Promise<CasaHudRunSummaryRow[]> {
  return query<CasaHudRunSummaryRow>(
    `
    SELECT
      r.id,
      r.user_id,
      r.project_id,
      r.status,
      r.objective,
      r.current_stage,
      p.selected_title,
      p.name as project_name,
      p.video_type,
      r.created_at,
      r.updated_at
    FROM casahud_generation_runs r
    LEFT JOIN casahud_projects p ON p.id = r.project_id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2
    `,
    [userId, limit],
  );
}

export async function getLatestCasaHudRunOutput(userId: string): Promise<CasaHudOrchestratorOutput | null> {
  const result = await query<{ output_json: CasaHudOrchestratorOutput }>(
    `
    SELECT output_json
    FROM casahud_run_outputs
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId],
  );

  return result[0]?.output_json || null;
}

export class DatabaseCasaHudRepository implements CasaHudProductionRepository {
  async createRun(run: CasaHudGenerationRun): Promise<void> {
    await query(
      `
      INSERT INTO casahud_generation_runs
      (id, user_id, project_id, status, objective, current_stage, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id)
      DO UPDATE SET
        project_id = EXCLUDED.project_id,
        status = EXCLUDED.status,
        current_stage = EXCLUDED.current_stage,
        updated_at = EXCLUDED.updated_at
      `,
      [run.id, run.userId, run.projectId || null, run.status, run.objective, run.currentStage, run.createdAt, run.updatedAt],
    );
  }

  async updateRun(run: CasaHudGenerationRun): Promise<void> {
    await this.createRun(run);
  }

  async createProject(project: CasaHudProject): Promise<void> {
    await query(
      `
      INSERT INTO casahud_projects
      (id, user_id, name, selected_title, video_type, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        selected_title = EXCLUDED.selected_title,
        video_type = EXCLUDED.video_type,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      `,
      [
        project.id,
        project.userId,
        project.name,
        project.selectedTitle,
        project.videoType,
        project.status,
        project.createdAt,
        project.updatedAt,
      ],
    );
  }

  async saveStage(runId: string, stage: CasaHudStageRecord): Promise<void> {
    await query(
      `
      INSERT INTO casahud_run_stage_outputs
      (run_id, stage_name, status, output_json, error_message, retryable, started_at, completed_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
      ON CONFLICT (run_id, stage_name)
      DO UPDATE SET
        status = EXCLUDED.status,
        output_json = EXCLUDED.output_json,
        error_message = EXCLUDED.error_message,
        retryable = EXCLUDED.retryable,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at
      `,
      [
        runId,
        stage.name,
        stage.status,
        JSON.stringify(stage.output || null),
        stage.error || null,
        stage.retryable,
        stage.startedAt,
        stage.completedAt || null,
      ],
    );
  }

  async saveOutput(output: CasaHudOrchestratorOutput): Promise<void> {
    await query(
      `
      INSERT INTO casahud_run_outputs
      (run_id, user_id, output_json, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, now(), now())
      ON CONFLICT (run_id)
      DO UPDATE SET output_json = EXCLUDED.output_json, updated_at = now()
      `,
      [output.run.id, output.run.userId, JSON.stringify(output)],
    );

    if (output.project) {
      await this.createProject(output.project);
      await this.updateRun({ ...output.run, projectId: output.project.id });
    } else {
      await this.updateRun(output.run);
    }

    await query(
      `
      INSERT INTO casahud_youtube_research_results
      (run_id, user_id, provider, status, query, result_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
      ON CONFLICT (run_id)
      DO UPDATE SET
        provider = EXCLUDED.provider,
        status = EXCLUDED.status,
        query = EXCLUDED.query,
        result_json = EXCLUDED.result_json
      `,
      [
        output.run.id,
        output.run.userId,
        output.research.provider,
        output.research.status,
        output.research.query,
        JSON.stringify(output.research),
      ],
    );

    for (const candidate of output.titleCandidates) {
      await query(
        `
        INSERT INTO casahud_title_candidates
        (id, run_id, user_id, title, score, selected, scoring_json, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
        ON CONFLICT (id)
        DO UPDATE SET score = EXCLUDED.score, selected = EXCLUDED.selected, scoring_json = EXCLUDED.scoring_json
        `,
        [candidate.id, output.run.id, output.run.userId, candidate.title, candidate.score, candidate.selected, JSON.stringify(candidate)],
      );
    }

    if (output.project) {
      await query(
        `
        INSERT INTO casahud_content_strategies
        (run_id, project_id, user_id, video_type, strategy_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
        ON CONFLICT (run_id)
        DO UPDATE SET video_type = EXCLUDED.video_type, strategy_json = EXCLUDED.strategy_json, updated_at = now()
        `,
        [output.run.id, output.project.id, output.run.userId, output.strategy.videoType, JSON.stringify(output.strategy)],
      );
    }

    await query(
      `
      INSERT INTO casahud_listing_discovery_results
      (run_id, user_id, status, provider, result_json, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
      ON CONFLICT (run_id)
      DO UPDATE SET status = EXCLUDED.status, provider = EXCLUDED.provider, result_json = EXCLUDED.result_json, updated_at = now()
      `,
      [
        output.run.id,
        output.run.userId,
        output.listingDiscovery.status,
        output.listingDiscovery.provider,
        JSON.stringify(output.listingDiscovery),
      ],
    );

    const listings = output.listingValidation?.selectedListings || output.listingDiscovery.listings;
    for (const listing of listings) {
      const listingId = listing.providerMetadata?.listingId
        ? String(listing.providerMetadata.listingId)
        : `${output.run.id}:${listing.listingUrl || listing.title}`;
      await query(
        `
        INSERT INTO casahud_imported_listings
        (id, run_id, user_id, provider, source_url, source_attribution, listing_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
        ON CONFLICT (id)
        DO UPDATE SET listing_json = EXCLUDED.listing_json, updated_at = now()
        `,
        [
          listingId,
          output.run.id,
          output.run.userId,
          listing.provider || "manual",
          listing.listingUrl || null,
          listing.sourceAttribution || listing.source || null,
          JSON.stringify(listing),
        ],
      );
    }

    if (output.listingValidation) {
      for (const validation of output.listingValidation.validations) {
        await query(
          `
          INSERT INTO casahud_listing_validation_results
          (id, run_id, user_id, listing_title, valid, score, validation_json, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
          ON CONFLICT (id)
          DO UPDATE SET valid = EXCLUDED.valid, score = EXCLUDED.score, validation_json = EXCLUDED.validation_json
          `,
          [
            validation.listingId,
            output.run.id,
            output.run.userId,
            validation.title,
            validation.valid,
            validation.score,
            JSON.stringify(validation),
          ],
        );
      }
    }

    for (const item of output.locationIntelligence) {
      await query(
        `
        INSERT INTO casahud_location_enrichments
        (id, run_id, user_id, listing_title, provider, enrichment_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
        ON CONFLICT (id)
        DO UPDATE SET provider = EXCLUDED.provider, enrichment_json = EXCLUDED.enrichment_json, updated_at = now()
        `,
        [
          `${output.run.id}:${item.listingTitle}`,
          output.run.id,
          output.run.userId,
          item.listingTitle,
          item.enrichment.provider,
          JSON.stringify(item),
        ],
      );
    }

    if (output.script) {
      await query(
        `
        INSERT INTO casahud_script_outputs
        (run_id, user_id, title, script_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now(), now())
        ON CONFLICT (run_id)
        DO UPDATE SET title = EXCLUDED.title, script_json = EXCLUDED.script_json, updated_at = now()
        `,
        [output.run.id, output.run.userId, output.script.titleUsed, JSON.stringify(output.script)],
      );
    }

    if (output.storyboard) {
      await query(
        `
        INSERT INTO casahud_storyboards
        (run_id, user_id, storyboard_json, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, now(), now())
        ON CONFLICT (run_id)
        DO UPDATE SET storyboard_json = EXCLUDED.storyboard_json, updated_at = now()
        `,
        [output.run.id, output.run.userId, JSON.stringify(output.storyboard)],
      );
      await query(
        `
        INSERT INTO casahud_render_plans
        (id, run_id, user_id, render_plan_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now(), now())
        ON CONFLICT (id)
        DO UPDATE SET render_plan_json = EXCLUDED.render_plan_json, updated_at = now()
        `,
        [output.storyboard.renderPlan.id, output.run.id, output.run.userId, JSON.stringify(output.storyboard.renderPlan)],
      );
      await query(
        `
        INSERT INTO casahud_render_jobs
        (id, run_id, user_id, status, render_plan_id, job_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
        ON CONFLICT (id)
        DO UPDATE SET status = EXCLUDED.status, job_json = EXCLUDED.job_json, updated_at = now()
        `,
        [
          `${output.storyboard.renderPlan.id}:review-gated`,
          output.run.id,
          output.run.userId,
          "awaiting_review",
          output.storyboard.renderPlan.id,
          JSON.stringify({ status: "awaiting_review", renderPlanId: output.storyboard.renderPlan.id }),
        ],
      );
    }

    if (output.youtubePackage) {
      await query(
        `
        INSERT INTO casahud_youtube_packages
        (run_id, user_id, title, package_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now(), now())
        ON CONFLICT (run_id)
        DO UPDATE SET title = EXCLUDED.title, package_json = EXCLUDED.package_json, updated_at = now()
        `,
        [output.run.id, output.run.userId, output.youtubePackage.finalRecommendedTitle, JSON.stringify(output.youtubePackage)],
      );
    }

    if (output.review) {
      await query(
        `
        INSERT INTO casahud_review_states
        (run_id, user_id, status, review_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now(), now())
        ON CONFLICT (run_id)
        DO UPDATE SET status = EXCLUDED.status, review_json = EXCLUDED.review_json, updated_at = now()
        `,
        [output.run.id, output.run.userId, output.review.status, JSON.stringify(output.review)],
      );
    }
  }
}
