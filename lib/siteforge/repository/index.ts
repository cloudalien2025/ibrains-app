import { getBrainLearningPool } from "@/lib/brain-learning/db";
import {
  BuildSession,
  HomepageStrategyMode,
  SiteForgeConnection,
  SiteForgeProject,
  SiteForgeRunLog,
  SiteForgeSnapshot,
  SiteForgeWorkspace,
  StoredAiSecret,
  StoredConnectionSecret,
  WebsiteBrief,
} from "@/lib/siteforge/contracts";
import { SiteForgeFailureRecord, SiteForgeRepository } from "@/lib/siteforge/repository/types";
import { nowIso } from "@/lib/siteforge/utils";

type MemoryStore = {
  projects: Map<string, SiteForgeProject>;
  sessions: Map<string, BuildSession>;
  failures: Map<string, SiteForgeFailureRecord[]>;
  connectionsByProject: Map<string, SiteForgeConnection>;
  connectionSecrets: Map<string, StoredConnectionSecret>;
  aiSecretsByProject: Map<string, StoredAiSecret>;
  snapshotsByProject: Map<string, SiteForgeSnapshot>;
  runLogsBySession: Map<string, SiteForgeRunLog[]>;
  lastOpenedProjectByUser: Map<string, string>;
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
      connectionsByProject: new Map(),
      connectionSecrets: new Map(),
      aiSecretsByProject: new Map(),
      snapshotsByProject: new Map(),
      runLogsBySession: new Map(),
      lastOpenedProjectByUser: new Map(),
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
    runState: patch.runState ? patch.runState : session.runState,
    revisionHistory: patch.revisionHistory ? patch.revisionHistory : session.revisionHistory,
    updatedAt: patch.updatedAt ?? nowIso(),
  };
}

type SiteForgeProjectRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  status: SiteForgeProject["status"] | null;
  site_type: string | null;
  primary_prompt: string | null;
  current_state: string | null;
  homepage_strategy: HomepageStrategyMode | null;
  website_brief: WebsiteBrief | null;
  ai_provider: "openai" | null;
  ai_model: string | null;
  ai_secret_ref: string | null;
  has_saved_ai_secret: boolean | null;
  last_opened_at: string | Date | null;
  description: string;
  latest_session_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteForgeConnectionRow = {
  id: string;
  project_id: string;
  label: string;
  wordpress_url: string;
  username: string;
  auth_type: "application_password";
  secret_ref: string | null;
  secret_ciphertext: string | null;
  thrive_detected: boolean;
  write_access: boolean;
  last_validated_at: string | Date | null;
  last_validation_status: SiteForgeConnection["lastValidationStatus"];
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteForgeSessionRow = {
  id: string;
  project_id: string;
  user_id: string;
  connection_id: string | null;
  session_type: BuildSession["type"] | null;
  trigger_source: BuildSession["triggerSource"] | null;
  prompt: string;
  website_brief: BuildSession["websiteBrief"];
  generation_source: BuildSession["generationSource"] | null;
  ai_model: string | null;
  connection_profile: BuildSession["connectionProfile"] | null;
  status: BuildSession["status"];
  run_state: BuildSession["runState"];
  site_plan: BuildSession["sitePlan"];
  content_package: BuildSession["contentPackage"];
  build_spec: BuildSession["buildSpec"];
  qa_result: BuildSession["qaResult"];
  execution_result: BuildSession["executionResult"];
  revision_history: BuildSession["revisionHistory"] | null;
  error_summary: string | null;
  started_at: string | Date;
  completed_at: string | Date | null;
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

type SiteForgeRunLogRow = {
  id: string;
  session_id: string;
  stage: SiteForgeRunLog["stage"];
  message: string;
  level: SiteForgeRunLog["level"];
  happened_at: string | Date;
};

type SiteForgeSnapshotRow = {
  id: string;
  project_id: string;
  connection_id: string | null;
  current_homepage_id: number | null;
  current_homepage_title: string | null;
  current_homepage_source: SiteForgeSnapshot["currentHomepageSource"];
  known_pages: SiteForgeSnapshot["knownPages"];
  known_menus: SiteForgeSnapshot["knownMenus"];
  thrive_detected: boolean;
  homepage_strategy: HomepageStrategyMode;
  last_run_summary: string | null;
  last_run_status: BuildSession["status"] | null;
  pages_affected: number;
  last_synced_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

function mapProjectRow(row: SiteForgeProjectRow): SiteForgeProject {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug ?? (row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project"),
    status: row.status ?? "draft",
    siteType: row.site_type,
    primaryPrompt: row.primary_prompt,
    currentState: row.current_state ?? "workspace",
    homepageStrategy: row.homepage_strategy ?? "use_existing",
    websiteBrief: row.website_brief ?? null,
    aiProvider: row.ai_provider ?? null,
    aiModel: row.ai_model ?? null,
    aiSecretRef: row.ai_secret_ref ?? null,
    hasSavedAiSecret: row.has_saved_ai_secret ?? false,
    lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at).toISOString() : null,
    description: row.description,
    latestSessionId: row.latest_session_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapConnectionRow(row: SiteForgeConnectionRow): SiteForgeConnection {
  return {
    connectionId: row.id,
    projectId: row.project_id,
    label: row.label,
    wordpressUrl: row.wordpress_url,
    username: row.username,
    authType: row.auth_type,
    secretRef: row.secret_ref,
    hasSavedSecret: Boolean(row.secret_ref && row.secret_ciphertext),
    thriveDetected: row.thrive_detected,
    writeAccess: row.write_access,
    lastValidatedAt: row.last_validated_at ? new Date(row.last_validated_at).toISOString() : null,
    lastValidationStatus: row.last_validation_status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSessionRow(row: SiteForgeSessionRow): BuildSession {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    connectionId: row.connection_id,
    type: row.session_type ?? "generate",
    triggerSource: row.trigger_source ?? "user",
    prompt: row.prompt,
    websiteBrief: row.website_brief ?? null,
    generationSource: row.generation_source ?? "deterministic_fallback",
    aiModel: row.ai_model ?? null,
    connectionProfile: row.connection_profile,
    status: row.status,
    runState: row.run_state,
    sitePlan: row.site_plan,
    contentPackage: row.content_package,
    buildSpec: row.build_spec,
    qaResult: row.qa_result,
    executionResult: row.execution_result,
    revisionHistory: row.revision_history ?? [],
    errorSummary: row.error_summary,
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
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

function mapRunLogRow(row: SiteForgeRunLogRow): SiteForgeRunLog {
  return {
    logId: row.id,
    sessionId: row.session_id,
    stage: row.stage,
    message: row.message,
    level: row.level,
    timestamp: new Date(row.happened_at).toISOString(),
  };
}

function mapSnapshotRow(row: SiteForgeSnapshotRow): SiteForgeSnapshot {
  return {
    snapshotId: row.id,
    projectId: row.project_id,
    connectionId: row.connection_id,
    currentHomepageId: row.current_homepage_id,
    currentHomepageTitle: row.current_homepage_title,
    currentHomepageSource: row.current_homepage_source,
    knownPages: Array.isArray(row.known_pages) ? row.known_pages : [],
    knownMenus: Array.isArray(row.known_menus) ? row.known_menus : [],
    thriveDetected: row.thrive_detected,
    homepageStrategy: row.homepage_strategy,
    lastRunSummary: row.last_run_summary,
    lastRunStatus: row.last_run_status,
    pagesAffected: row.pages_affected,
    lastSyncedAt: new Date(row.last_synced_at).toISOString(),
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
      .sort((a, b) => Date.parse((b.lastOpenedAt ?? b.updatedAt)) - Date.parse((a.lastOpenedAt ?? a.updatedAt)));
  }

  async getProject(projectId: string, userId: string): Promise<SiteForgeProject | null> {
    const project = this.store.projects.get(projectId);
    if (!project || project.userId !== userId) return null;
    return project;
  }

  async updateProject(projectId: string, patch: Partial<SiteForgeProject>): Promise<void> {
    const current = this.store.projects.get(projectId);
    if (!current) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as Partial<SiteForgeProject>;
    this.store.projects.set(projectId, { ...current, ...safePatch, updatedAt: nowIso() });
  }

  async getLastOpenedProjectId(userId: string): Promise<string | null> {
    return this.store.lastOpenedProjectByUser.get(userId) ?? null;
  }

  async markProjectOpened(userId: string, projectId: string): Promise<void> {
    this.store.lastOpenedProjectByUser.set(userId, projectId);
    const project = this.store.projects.get(projectId);
    if (!project) return;
    this.store.projects.set(projectId, { ...project, lastOpenedAt: nowIso(), updatedAt: nowIso() });
  }

  async upsertConnection(params: {
    projectId: string;
    connection: SiteForgeConnection;
    secret?: StoredConnectionSecret | null;
  }): Promise<SiteForgeConnection> {
    const existing = this.store.connectionsByProject.get(params.projectId);
    const merged: SiteForgeConnection = {
      ...(existing ?? params.connection),
      ...params.connection,
      projectId: params.projectId,
      updatedAt: nowIso(),
      createdAt: existing?.createdAt ?? params.connection.createdAt,
      hasSavedSecret: params.secret ? true : (existing?.hasSavedSecret ?? params.connection.hasSavedSecret),
      secretRef: params.secret?.ref ?? params.connection.secretRef ?? existing?.secretRef ?? null,
    };
    this.store.connectionsByProject.set(params.projectId, merged);

    if (params.secret) {
      this.store.connectionSecrets.set(merged.connectionId, params.secret);
    }

    return merged;
  }

  async getProjectConnection(projectId: string): Promise<SiteForgeConnection | null> {
    return this.store.connectionsByProject.get(projectId) ?? null;
  }

  async getConnectionSecret(connectionId: string): Promise<StoredConnectionSecret | null> {
    return this.store.connectionSecrets.get(connectionId) ?? null;
  }

  async saveProjectAiConfig(params: {
    projectId: string;
    provider: "openai";
    model: string;
    secret?: StoredAiSecret | null;
  }): Promise<void> {
    const project = this.store.projects.get(params.projectId);
    if (!project) return;

    this.store.projects.set(params.projectId, {
      ...project,
      aiProvider: params.provider,
      aiModel: params.model,
      aiSecretRef: params.secret?.ref ?? project.aiSecretRef ?? null,
      hasSavedAiSecret: params.secret ? true : (project.hasSavedAiSecret ?? false),
      updatedAt: nowIso(),
    });

    if (params.secret) {
      this.store.aiSecretsByProject.set(params.projectId, params.secret);
    }
  }

  async getProjectAiSecret(projectId: string): Promise<StoredAiSecret | null> {
    return this.store.aiSecretsByProject.get(projectId) ?? null;
  }

  async clearProjectAiSecret(projectId: string): Promise<void> {
    this.store.aiSecretsByProject.delete(projectId);
    const project = this.store.projects.get(projectId);
    if (!project) return;
    this.store.projects.set(projectId, {
      ...project,
      aiProvider: project.aiProvider ?? "openai",
      aiSecretRef: null,
      hasSavedAiSecret: false,
      updatedAt: nowIso(),
    });
  }

  async updateConnectionValidation(connectionId: string, patch: {
    status: SiteForgeConnection["lastValidationStatus"];
    thriveDetected: boolean;
    writeAccess: boolean;
    lastValidatedAt: string;
  }): Promise<void> {
    const connection = [...this.store.connectionsByProject.values()].find((item) => item.connectionId === connectionId);
    if (!connection) return;

    this.store.connectionsByProject.set(connection.projectId, {
      ...connection,
      lastValidationStatus: patch.status,
      thriveDetected: patch.thriveDetected,
      writeAccess: patch.writeAccess,
      lastValidatedAt: patch.lastValidatedAt,
      updatedAt: nowIso(),
    });
  }

  async setProjectHomepageStrategy(projectId: string, strategy: HomepageStrategyMode): Promise<void> {
    const project = this.store.projects.get(projectId);
    if (!project) return;
    this.store.projects.set(projectId, {
      ...project,
      homepageStrategy: strategy,
      updatedAt: nowIso(),
    });
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

  async appendRunLog(log: SiteForgeRunLog): Promise<void> {
    const list = this.store.runLogsBySession.get(log.sessionId) ?? [];
    this.store.runLogsBySession.set(log.sessionId, [log, ...list]);
  }

  async listRunLogs(projectId: string, userId: string): Promise<SiteForgeRunLog[]> {
    const sessionIds = new Set(
      [...this.store.sessions.values()]
        .filter((session) => session.projectId === projectId && session.userId === userId)
        .map((session) => session.id)
    );

    const logs: SiteForgeRunLog[] = [];
    for (const [sessionId, list] of this.store.runLogsBySession.entries()) {
      if (sessionIds.has(sessionId)) logs.push(...list);
    }

    return logs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }

  async upsertSnapshot(snapshot: SiteForgeSnapshot): Promise<SiteForgeSnapshot> {
    this.store.snapshotsByProject.set(snapshot.projectId, snapshot);
    return snapshot;
  }

  async getLatestSnapshot(projectId: string): Promise<SiteForgeSnapshot | null> {
    return this.store.snapshotsByProject.get(projectId) ?? null;
  }

  async getWorkspace(projectId: string, userId: string): Promise<SiteForgeWorkspace | null> {
    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const runHistory = await this.listSessions(projectId, userId);
    const runLogs = await this.listRunLogs(projectId, userId);

    return {
      project,
      activeConnection: await this.getProjectConnection(projectId),
      snapshot: await this.getLatestSnapshot(projectId),
      latestRun: runHistory[0] ?? null,
      runHistory,
      runLogs,
    };
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
      ? sessions.map((session) => session.updatedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
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
      `INSERT INTO siteforge_projects (
        id, user_id, name, slug, status, site_type, primary_prompt, current_state,
        homepage_strategy, website_brief, ai_provider, ai_model, ai_secret_ref, has_saved_ai_secret,
        last_opened_at, description, latest_session_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        project.id,
        project.userId,
        project.name,
        project.slug,
        project.status,
        project.siteType,
        project.primaryPrompt,
        project.currentState,
        project.homepageStrategy,
        project.websiteBrief ? JSON.stringify(project.websiteBrief) : null,
        project.aiProvider ?? null,
        project.aiModel ?? null,
        project.aiSecretRef ?? null,
        project.hasSavedAiSecret ?? false,
        project.lastOpenedAt,
        project.description,
        project.latestSessionId,
        project.createdAt,
        project.updatedAt,
      ]
    );
    return project;
  }

  async listProjects(userId: string): Promise<SiteForgeProject[]> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeProjectRow>(
      `SELECT
        id, user_id, name, slug, status, site_type, primary_prompt, current_state,
        homepage_strategy, website_brief, ai_provider, ai_model, ai_secret_ref, has_saved_ai_secret,
        last_opened_at, description, latest_session_id, created_at, updated_at
       FROM siteforge_projects
       WHERE user_id = $1
       ORDER BY COALESCE(last_opened_at, updated_at) DESC`,
      [userId]
    );
    return result.rows.map(mapProjectRow);
  }

  async getProject(projectId: string, userId: string): Promise<SiteForgeProject | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeProjectRow>(
      `SELECT
        id, user_id, name, slug, status, site_type, primary_prompt, current_state,
        homepage_strategy, website_brief, ai_provider, ai_model, ai_secret_ref, has_saved_ai_secret,
        last_opened_at, description, latest_session_id, created_at, updated_at
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
        slug = COALESCE($3, slug),
        status = COALESCE($4, status),
        site_type = COALESCE($5, site_type),
        primary_prompt = COALESCE($6, primary_prompt),
        current_state = COALESCE($7, current_state),
        homepage_strategy = COALESCE($8, homepage_strategy),
        website_brief = COALESCE($9, website_brief),
        ai_provider = COALESCE($10, ai_provider),
        ai_model = COALESCE($11, ai_model),
        ai_secret_ref = COALESCE($12, ai_secret_ref),
        has_saved_ai_secret = COALESCE($13, has_saved_ai_secret),
        last_opened_at = COALESCE($14, last_opened_at),
        description = COALESCE($15, description),
        latest_session_id = COALESCE($16, latest_session_id),
        updated_at = $17
      WHERE id = $1`,
      [
        projectId,
        patch.name ?? null,
        patch.slug ?? null,
        patch.status ?? null,
        patch.siteType ?? null,
        patch.primaryPrompt ?? null,
        patch.currentState ?? null,
        patch.homepageStrategy ?? null,
        patch.websiteBrief ? JSON.stringify(patch.websiteBrief) : null,
        patch.aiProvider ?? null,
        patch.aiModel ?? null,
        patch.aiSecretRef ?? null,
        patch.hasSavedAiSecret ?? null,
        patch.lastOpenedAt ?? null,
        patch.description ?? null,
        patch.latestSessionId ?? null,
        nowIso(),
      ]
    );
  }

  async getLastOpenedProjectId(userId: string): Promise<string | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<{ project_id: string }>(
      `SELECT project_id FROM siteforge_user_workspace_state WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.project_id ?? null;
  }

  async markProjectOpened(userId: string, projectId: string): Promise<void> {
    const pool = getBrainLearningPool();
    const now = nowIso();

    await pool.query(
      `INSERT INTO siteforge_user_workspace_state (user_id, project_id, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET project_id = EXCLUDED.project_id, updated_at = EXCLUDED.updated_at`,
      [userId, projectId, now]
    );

    await pool.query(
      `UPDATE siteforge_projects SET last_opened_at = $2, updated_at = $2 WHERE id = $1`,
      [projectId, now]
    );
  }

  async upsertConnection(params: {
    projectId: string;
    connection: SiteForgeConnection;
    secret?: StoredConnectionSecret | null;
  }): Promise<SiteForgeConnection> {
    const pool = getBrainLearningPool();
    const secretRef = params.secret?.ref ?? params.connection.secretRef;
    const secretCipher = params.secret?.cipherText ?? null;

    await pool.query(
      `INSERT INTO siteforge_connections (
         id, project_id, label, wordpress_url, username, auth_type, secret_ref, secret_ciphertext,
         thrive_detected, write_access, last_validated_at, last_validation_status, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (project_id)
       DO UPDATE SET
         id = EXCLUDED.id,
         label = EXCLUDED.label,
         wordpress_url = EXCLUDED.wordpress_url,
         username = EXCLUDED.username,
         auth_type = EXCLUDED.auth_type,
         secret_ref = COALESCE(EXCLUDED.secret_ref, siteforge_connections.secret_ref),
         secret_ciphertext = COALESCE(EXCLUDED.secret_ciphertext, siteforge_connections.secret_ciphertext),
         thrive_detected = EXCLUDED.thrive_detected,
         write_access = EXCLUDED.write_access,
         last_validated_at = EXCLUDED.last_validated_at,
         last_validation_status = EXCLUDED.last_validation_status,
         updated_at = EXCLUDED.updated_at`,
      [
        params.connection.connectionId,
        params.projectId,
        params.connection.label,
        params.connection.wordpressUrl,
        params.connection.username,
        params.connection.authType,
        secretRef,
        secretCipher,
        params.connection.thriveDetected,
        params.connection.writeAccess,
        params.connection.lastValidatedAt,
        params.connection.lastValidationStatus,
        params.connection.createdAt,
        nowIso(),
      ]
    );

    const saved = await this.getProjectConnection(params.projectId);
    if (!saved) {
      throw new Error("Connection save failed.");
    }

    return saved;
  }

  async getProjectConnection(projectId: string): Promise<SiteForgeConnection | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeConnectionRow>(
      `SELECT * FROM siteforge_connections WHERE project_id = $1 LIMIT 1`,
      [projectId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return mapConnectionRow(row);
  }

  async getConnectionSecret(connectionId: string): Promise<StoredConnectionSecret | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<{ secret_ref: string | null; secret_ciphertext: string | null }>(
      `SELECT secret_ref, secret_ciphertext FROM siteforge_connections WHERE id = $1 LIMIT 1`,
      [connectionId]
    );
    const row = result.rows[0];
    if (!row?.secret_ref || !row?.secret_ciphertext) return null;
    return {
      ref: row.secret_ref,
      cipherText: row.secret_ciphertext,
    };
  }

  async saveProjectAiConfig(params: {
    projectId: string;
    provider: "openai";
    model: string;
    secret?: StoredAiSecret | null;
  }): Promise<void> {
    const pool = getBrainLearningPool();
    const secretRef = params.secret?.ref ?? null;
    const secretCipher = params.secret?.cipherText ?? null;

    await pool.query(
      `INSERT INTO siteforge_project_ai_configs (
         project_id, provider, model, secret_ref, secret_ciphertext, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id)
       DO UPDATE SET
         provider = EXCLUDED.provider,
         model = EXCLUDED.model,
         secret_ref = COALESCE(EXCLUDED.secret_ref, siteforge_project_ai_configs.secret_ref),
         secret_ciphertext = COALESCE(EXCLUDED.secret_ciphertext, siteforge_project_ai_configs.secret_ciphertext),
         updated_at = EXCLUDED.updated_at`,
      [params.projectId, params.provider, params.model, secretRef, secretCipher, nowIso(), nowIso()]
    );

    await pool.query(
      `UPDATE siteforge_projects
       SET ai_provider = $2,
           ai_model = $3,
           ai_secret_ref = COALESCE($4, ai_secret_ref),
           has_saved_ai_secret = CASE WHEN $4 IS NULL THEN has_saved_ai_secret ELSE true END,
           updated_at = $5
       WHERE id = $1`,
      [params.projectId, params.provider, params.model, secretRef, nowIso()]
    );
  }

  async getProjectAiSecret(projectId: string): Promise<StoredAiSecret | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<{ secret_ref: string | null; secret_ciphertext: string | null }>(
      `SELECT secret_ref, secret_ciphertext
       FROM siteforge_project_ai_configs
       WHERE project_id = $1
       LIMIT 1`,
      [projectId]
    );
    const row = result.rows[0];
    if (!row?.secret_ref || !row?.secret_ciphertext) return null;
    return {
      ref: row.secret_ref,
      cipherText: row.secret_ciphertext,
    };
  }

  async clearProjectAiSecret(projectId: string): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `UPDATE siteforge_project_ai_configs
       SET secret_ref = NULL, secret_ciphertext = NULL, updated_at = $2
       WHERE project_id = $1`,
      [projectId, nowIso()]
    );
    await pool.query(
      `UPDATE siteforge_projects
       SET ai_secret_ref = NULL, has_saved_ai_secret = false, updated_at = $2
       WHERE id = $1`,
      [projectId, nowIso()]
    );
  }

  async updateConnectionValidation(connectionId: string, patch: {
    status: SiteForgeConnection["lastValidationStatus"];
    thriveDetected: boolean;
    writeAccess: boolean;
    lastValidatedAt: string;
  }): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `UPDATE siteforge_connections SET
        last_validation_status = $2,
        thrive_detected = $3,
        write_access = $4,
        last_validated_at = $5,
        updated_at = $6
      WHERE id = $1`,
      [connectionId, patch.status, patch.thriveDetected, patch.writeAccess, patch.lastValidatedAt, nowIso()]
    );
  }

  async setProjectHomepageStrategy(projectId: string, strategy: HomepageStrategyMode): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `UPDATE siteforge_projects SET homepage_strategy = $2, updated_at = $3 WHERE id = $1`,
      [projectId, strategy, nowIso()]
    );
  }

  async createSession(session: BuildSession): Promise<BuildSession> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_sessions (
        id, project_id, user_id, connection_id, session_type, trigger_source,
        prompt, website_brief, generation_source, ai_model, connection_profile, status, run_state, site_plan, content_package,
        build_spec, qa_result, execution_result, revision_history, error_summary,
        started_at, completed_at, finished_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25
      )`,
      [
        session.id,
        session.projectId,
        session.userId,
        session.connectionId,
        session.type,
        session.triggerSource,
        session.prompt,
        session.websiteBrief ? JSON.stringify(session.websiteBrief) : null,
        session.generationSource,
        session.aiModel,
        session.connectionProfile ? JSON.stringify(session.connectionProfile) : null,
        session.status,
        JSON.stringify(session.runState),
        session.sitePlan ? JSON.stringify(session.sitePlan) : null,
        session.contentPackage ? JSON.stringify(session.contentPackage) : null,
        session.buildSpec ? JSON.stringify(session.buildSpec) : null,
        session.qaResult ? JSON.stringify(session.qaResult) : null,
        session.executionResult ? JSON.stringify(session.executionResult) : null,
        JSON.stringify(session.revisionHistory),
        session.errorSummary,
        session.startedAt,
        session.completedAt,
        session.finishedAt,
        session.createdAt,
        session.updatedAt,
      ]
    );
    return session;
  }

  async getSession(sessionId: string): Promise<BuildSession | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeSessionRow>(`SELECT * FROM siteforge_sessions WHERE id = $1 LIMIT 1`, [
      sessionId,
    ]);
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
        connection_id = $2,
        session_type = $3,
        trigger_source = $4,
        prompt = $5,
        website_brief = $6,
        generation_source = $7,
        ai_model = $8,
        connection_profile = $9,
        status = $10,
        run_state = $11,
        site_plan = $12,
        content_package = $13,
        build_spec = $14,
        qa_result = $15,
        execution_result = $16,
        revision_history = $17,
        error_summary = $18,
        completed_at = $19,
        finished_at = $20,
        updated_at = $21
      WHERE id = $1`,
      [
        sessionId,
        merged.connectionId,
        merged.type,
        merged.triggerSource,
        merged.prompt,
        merged.websiteBrief ? JSON.stringify(merged.websiteBrief) : null,
        merged.generationSource,
        merged.aiModel,
        merged.connectionProfile ? JSON.stringify(merged.connectionProfile) : null,
        merged.status,
        JSON.stringify(merged.runState),
        merged.sitePlan ? JSON.stringify(merged.sitePlan) : null,
        merged.contentPackage ? JSON.stringify(merged.contentPackage) : null,
        merged.buildSpec ? JSON.stringify(merged.buildSpec) : null,
        merged.qaResult ? JSON.stringify(merged.qaResult) : null,
        merged.executionResult ? JSON.stringify(merged.executionResult) : null,
        JSON.stringify(merged.revisionHistory),
        merged.errorSummary,
        merged.completedAt,
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
      type: "refine",
    });
  }

  async appendRunLog(log: SiteForgeRunLog): Promise<void> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_run_logs (id, session_id, stage, message, level, happened_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [log.logId, log.sessionId, log.stage, log.message, log.level, log.timestamp]
    );
  }

  async listRunLogs(projectId: string, userId: string): Promise<SiteForgeRunLog[]> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeRunLogRow>(
      `SELECT logs.id, logs.session_id, logs.stage, logs.message, logs.level, logs.happened_at
       FROM siteforge_run_logs logs
       INNER JOIN siteforge_sessions sessions ON sessions.id = logs.session_id
       WHERE sessions.project_id = $1 AND sessions.user_id = $2
       ORDER BY logs.happened_at DESC`,
      [projectId, userId]
    );
    return result.rows.map(mapRunLogRow);
  }

  async upsertSnapshot(snapshot: SiteForgeSnapshot): Promise<SiteForgeSnapshot> {
    const pool = getBrainLearningPool();
    await pool.query(
      `INSERT INTO siteforge_snapshots (
        id, project_id, connection_id, current_homepage_id, current_homepage_title, current_homepage_source,
        known_pages, known_menus, thrive_detected, homepage_strategy, last_run_summary,
        last_run_status, pages_affected, last_synced_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16
      )
      ON CONFLICT (project_id)
      DO UPDATE SET
        id = EXCLUDED.id,
        connection_id = EXCLUDED.connection_id,
        current_homepage_id = EXCLUDED.current_homepage_id,
        current_homepage_title = EXCLUDED.current_homepage_title,
        current_homepage_source = EXCLUDED.current_homepage_source,
        known_pages = EXCLUDED.known_pages,
        known_menus = EXCLUDED.known_menus,
        thrive_detected = EXCLUDED.thrive_detected,
        homepage_strategy = EXCLUDED.homepage_strategy,
        last_run_summary = EXCLUDED.last_run_summary,
        last_run_status = EXCLUDED.last_run_status,
        pages_affected = EXCLUDED.pages_affected,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at`,
      [
        snapshot.snapshotId,
        snapshot.projectId,
        snapshot.connectionId,
        snapshot.currentHomepageId,
        snapshot.currentHomepageTitle,
        snapshot.currentHomepageSource,
        JSON.stringify(snapshot.knownPages),
        JSON.stringify(snapshot.knownMenus),
        snapshot.thriveDetected,
        snapshot.homepageStrategy,
        snapshot.lastRunSummary,
        snapshot.lastRunStatus,
        snapshot.pagesAffected,
        snapshot.lastSyncedAt,
        snapshot.lastSyncedAt,
        nowIso(),
      ]
    );
    return snapshot;
  }

  async getLatestSnapshot(projectId: string): Promise<SiteForgeSnapshot | null> {
    const pool = getBrainLearningPool();
    const result = await pool.query<SiteForgeSnapshotRow>(
      `SELECT * FROM siteforge_snapshots WHERE project_id = $1 LIMIT 1`,
      [projectId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return mapSnapshotRow(row);
  }

  async getWorkspace(projectId: string, userId: string): Promise<SiteForgeWorkspace | null> {
    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const [activeConnection, snapshot, runHistory, runLogs] = await Promise.all([
      this.getProjectConnection(projectId),
      this.getLatestSnapshot(projectId),
      this.listSessions(projectId, userId),
      this.listRunLogs(projectId, userId),
    ]);

    return {
      project,
      activeConnection,
      snapshot,
      latestRun: runHistory[0] ?? null,
      runHistory,
      runLogs,
    };
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
      pool.query<{ updated_at: string | Date }>(`SELECT updated_at FROM siteforge_sessions ORDER BY updated_at DESC LIMIT 1`),
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
