import { getBrainLearningPool } from "@/lib/brain-learning/db";
import { BuildSession, SiteForgeProject } from "@/lib/siteforge/contracts";
import { SiteForgeFailureRecord, SiteForgeRepository } from "@/lib/siteforge/repository/types";
import { nowIso } from "@/lib/siteforge/utils";

type MemoryStore = {
  projects: Map<string, SiteForgeProject>;
  sessions: Map<string, BuildSession>;
  failures: Map<string, SiteForgeFailureRecord[]>;
};

declare global {
  var __siteforge_memory_store__: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__siteforge_memory_store__) {
    globalThis.__siteforge_memory_store__ = {
      projects: new Map(),
      sessions: new Map(),
      failures: new Map(),
    };
  }
  return globalThis.__siteforge_memory_store__;
}

async function hasPostgresTables(): Promise<boolean> {
  try {
    const pool = getBrainLearningPool();
    const check = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'siteforge_projects'
      ) AS ok`
    );
    const row = check.rows[0] as { ok?: boolean } | undefined;
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}

function mergeSession(session: BuildSession, patch: Partial<BuildSession>): BuildSession {
  return {
    ...session,
    ...patch,
    runState: patch.runState
      ? patch.runState
      : session.runState,
    revisionHistory: patch.revisionHistory
      ? patch.revisionHistory
      : session.revisionHistory,
    updatedAt: patch.updatedAt ?? nowIso(),
  };
}

type SiteForgeProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  latest_session_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteForgeSessionRow = {
  id: string;
  project_id: string;
  user_id: string;
  prompt: string;
  connection_profile: BuildSession["connectionProfile"] | null;
  status: BuildSession["status"];
  run_state: BuildSession["runState"];
  site_plan: BuildSession["sitePlan"];
  content_package: BuildSession["contentPackage"];
  build_spec: BuildSession["buildSpec"];
  qa_result: BuildSession["qaResult"];
  execution_result: BuildSession["executionResult"];
  revision_history: BuildSession["revisionHistory"] | null;
  started_at: string | Date;
  finished_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteForgeFailureRow = {
  id: string;
  happened_at: string | Date;
  message: string;
  retryable: boolean;
  reason: string;
};

function mapProjectRow(row: SiteForgeProjectRow): SiteForgeProject {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    latestSessionId: row.latest_session_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSessionRow(row: SiteForgeSessionRow): BuildSession {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    prompt: row.prompt,
    connectionProfile: row.connection_profile,
    status: row.status,
    runState: row.run_state,
    sitePlan: row.site_plan,
    contentPackage: row.content_package,
    buildSpec: row.build_spec,
    qaResult: row.qa_result,
    executionResult: row.execution_result,
    revisionHistory: row.revision_history ?? [],
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapFailureRow(row: SiteForgeFailureRow): SiteForgeFailureRecord {
  return {
    id: row.id,
    at: new Date(row.happened_at).toISOString(),
    message: row.message,
    retryable: row.retryable,
    reason: row.reason,
  };
}

class MemoryRepository implements SiteForgeRepository {
  private readonly store = getMemoryStore();

  async createProject(project: SiteForgeProject): Promise<SiteForgeProject> {
    this.store.projects.set(project.id, project);
    return project;
  }

  async listProjects(userId: string): Promise<SiteForgeProject[]> {
    return [...this.store.projects.values()]
      .filter((project) => project.userId === userId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getProject(projectId: string, userId: string): Promise<SiteForgeProject | null> {
    const project = this.store.projects.get(projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  }

  async updateProject(projectId: string, patch: Partial<SiteForgeProject>): Promise<void> {
    const current = this.store.projects.get(projectId);
    if (!current) return;
    this.store.projects.set(projectId, { ...current, ...patch, updatedAt: nowIso() });
  }

  async createSession(session: BuildSession): Promise<BuildSession> {
    this.store.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<BuildSession | null> {
    return this.store.sessions.get(sessionId) ?? null;
  }

  async listSessions(projectId: string, userId: string): Promise<BuildSession[]> {
    return [...this.store.sessions.values()]
      .filter((session) => session.projectId === projectId && session.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async updateSession(sessionId: string, patch: Partial<BuildSession>): Promise<void> {
    const current = this.store.sessions.get(sessionId);
    if (!current) return;
    this.store.sessions.set(sessionId, mergeSession(current, patch));
  }

  async addRevision(sessionId: string, revision: BuildSession["revisionHistory"][number]): Promise<void> {
    const current = this.store.sessions.get(sessionId);
    if (!current) return;
    this.store.sessions.set(sessionId, {
      ...current,
      revisionHistory: [...current.revisionHistory, revision],
      updatedAt: nowIso(),
    });
  }

  async appendFailure(sessionId: string, failure: SiteForgeFailureRecord): Promise<void> {
    const list = this.store.failures.get(sessionId) ?? [];
    this.store.failures.set(sessionId, [...list, failure]);
  }

  async getFailures(sessionId: string): Promise<SiteForgeFailureRecord[]> {
    return this.store.failures.get(sessionId) ?? [];
  }

  async getAdminSummary(): Promise<{
    projects: number;
    sessions: number;
    activeRuns: number;
    failedRuns: number;
    completedRuns: number;
    lastRunAt: string | null;
    storageMode: "postgres" | "memory";
  }> {
    const sessions = [...this.store.sessions.values()];
    const lastRunAt = sessions.length
      ? sessions
          .map((session) => session.updatedAt)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
      : null;
    return {
      projects: this.store.projects.size,
      sessions: sessions.length,
      activeRuns: sessions.filter((session) => session.status === "running").length,
      failedRuns: sessions.filter((session) => session.status === "failed").length,
      completedRuns: sessions.filter((session) => session.status === "completed").length,
      lastRunAt,
      storageMode: "memory",
    };
  }
}

class PostgresRepository implements SiteForgeRepository {
  async createProject(project: SiteForgeProject): Promise<SiteForgeProject> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_projects (id, user_id, name, description, latest_session_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [project.id, project.userId, project.name, project.description, project.latestSessionId, project.createdAt, project.updatedAt]
    );
    return project;
  }

  async listProjects(userId: string): Promise<SiteForgeProject[]> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeProjectRow>(
      `SELECT id, user_id, name, description, latest_session_id, created_at, updated_at
       FROM siteforge_projects WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(mapProjectRow);
  }

  async getProject(projectId: string, userId: string): Promise<SiteForgeProject | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeProjectRow>(
      `SELECT id, user_id, name, description, latest_session_id, created_at, updated_at
       FROM siteforge_projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return mapProjectRow(row);
  }

  async updateProject(projectId: string, patch: Partial<SiteForgeProject>): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `UPDATE siteforge_projects SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        latest_session_id = COALESCE($4, latest_session_id),
        updated_at = $5
      WHERE id = $1`,
      [projectId, patch.name ?? null, patch.description ?? null, patch.latestSessionId ?? null, nowIso()]
    );
  }

  async createSession(session: BuildSession): Promise<BuildSession> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_sessions (
        id, project_id, user_id, prompt, connection_profile, status,
        run_state, site_plan, content_package, build_spec, qa_result,
        execution_result, revision_history, started_at, finished_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17
      )`,
      [
        session.id,
        session.projectId,
        session.userId,
        session.prompt,
        session.connectionProfile ? JSON.stringify(session.connectionProfile) : null,
        session.status,
        JSON.stringify(session.runState),
        session.sitePlan ? JSON.stringify(session.sitePlan) : null,
        session.contentPackage ? JSON.stringify(session.contentPackage) : null,
        session.buildSpec ? JSON.stringify(session.buildSpec) : null,
        session.qaResult ? JSON.stringify(session.qaResult) : null,
        session.executionResult ? JSON.stringify(session.executionResult) : null,
        JSON.stringify(session.revisionHistory),
        session.startedAt,
        session.finishedAt,
        session.createdAt,
        session.updatedAt,
      ]
    );
    return session;
  }

  async getSession(sessionId: string): Promise<BuildSession | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeSessionRow>(
      `SELECT * FROM siteforge_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );
    const row = result.rows[0];
    if (!row) return null;

    return mapSessionRow(row);
  }

  async listSessions(projectId: string, userId: string): Promise<BuildSession[]> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeSessionRow>(
      `SELECT * FROM siteforge_sessions WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [projectId, userId]
    );
    return result.rows.map(mapSessionRow);
  }

  async updateSession(sessionId: string, patch: Partial<BuildSession>): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) return;
    const merged = mergeSession(current, patch);

    const pool = getBrainLearningPool();
    await pool.query(
      `UPDATE siteforge_sessions SET
        connection_profile = $2,
        status = $3,
        run_state = $4,
        site_plan = $5,
        content_package = $6,
        build_spec = $7,
        qa_result = $8,
        execution_result = $9,
        revision_history = $10,
        finished_at = $11,
        updated_at = $12
      WHERE id = $1`,
      [
        sessionId,
        merged.connectionProfile ? JSON.stringify(merged.connectionProfile) : null,
        merged.status,
        JSON.stringify(merged.runState),
        merged.sitePlan ? JSON.stringify(merged.sitePlan) : null,
        merged.contentPackage ? JSON.stringify(merged.contentPackage) : null,
        merged.buildSpec ? JSON.stringify(merged.buildSpec) : null,
        merged.qaResult ? JSON.stringify(merged.qaResult) : null,
        merged.executionResult ? JSON.stringify(merged.executionResult) : null,
        JSON.stringify(merged.revisionHistory),
        merged.finishedAt,
        merged.updatedAt,
      ]
    );
  }

  async addRevision(sessionId: string, revision: BuildSession["revisionHistory"][number]): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) return;

    await this.updateSession(sessionId, {
      revisionHistory: [...current.revisionHistory, revision],
    });
  }

  async appendFailure(sessionId: string, failure: SiteForgeFailureRecord): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_failures (id, session_id, happened_at, message, retryable, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [failure.id, sessionId, failure.at, failure.message, failure.retryable, failure.reason]
    );
  }

  async getFailures(sessionId: string): Promise<SiteForgeFailureRecord[]> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeFailureRow>(
      `SELECT id, session_id, happened_at, message, retryable, reason
       FROM siteforge_failures WHERE session_id = $1 ORDER BY happened_at DESC`,
      [sessionId]
    );
    return result.rows.map(mapFailureRow);
  }

  async getAdminSummary(): Promise<{
    projects: number;
    sessions: number;
    activeRuns: number;
    failedRuns: number;
    completedRuns: number;
    lastRunAt: string | null;
    storageMode: "postgres" | "memory";
  }> {
    const pool = getBrainLearningPool();
    const [projects, sessions, status, latest] = await Promise.all([
      pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM siteforge_projects`),
      pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM siteforge_sessions`),
      pool.query<{ active_runs: number; failed_runs: number; completed_runs: number }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'running')::int AS active_runs,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_runs,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs
         FROM siteforge_sessions`
      ),
      pool.query<{ updated_at: string | Date }>(
        `SELECT updated_at FROM siteforge_sessions ORDER BY updated_at DESC LIMIT 1`
      ),
    ]);

    return {
      projects: projects.rows[0]?.count ?? 0,
      sessions: sessions.rows[0]?.count ?? 0,
      activeRuns: status.rows[0]?.active_runs ?? 0,
      failedRuns: status.rows[0]?.failed_runs ?? 0,
      completedRuns: status.rows[0]?.completed_runs ?? 0,
      lastRunAt: latest.rows[0]?.updated_at ? new Date(latest.rows[0].updated_at).toISOString() : null,
      storageMode: "postgres",
    };
  }
}

let repoPromise: Promise<SiteForgeRepository> | null = null;

export function getSiteForgeRepository(): Promise<SiteForgeRepository> {
  if (!repoPromise) {
    repoPromise = (async () => {
      const usePostgres = await hasPostgresTables();
      if (usePostgres) return new PostgresRepository();
      return new MemoryRepository();
    })();
  }

  return repoPromise;
}
