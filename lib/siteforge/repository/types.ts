import {
  BuildSession,
  ConnectionValidationStatus,
  HomepageStrategyMode,
  SiteForgeConnection,
  SiteForgeProject,
  SiteForgeRunLog,
  SiteForgeSnapshot,
  SiteForgeWorkspace,
  StoredAiSecret,
  StoredConnectionSecret,
} from "@/lib/siteforge/contracts";

export type SiteForgePersistenceHealth = "healthy" | "degraded" | "unavailable";

export type SiteForgeStorageSummary = {
  storageMode: "postgres" | "memory";
  persistenceHealth: SiteForgePersistenceHealth;
  fallbackAllowed: boolean;
  fallbackActive: boolean;
  reason: string | null;
};

export type SiteForgeFailureRecord = {
  id: string;
  at: string;
  message: string;
  retryable: boolean;
  reason: string;
};

export type SiteForgeRepository = {
  createProject(project: SiteForgeProject): Promise<SiteForgeProject>;
  listProjects(userId: string): Promise<SiteForgeProject[]>;
  getProject(projectId: string, userId: string): Promise<SiteForgeProject | null>;
  updateProject(projectId: string, patch: Partial<SiteForgeProject>): Promise<void>;
  getLastOpenedProjectId(userId: string): Promise<string | null>;
  markProjectOpened(userId: string, projectId: string): Promise<void>;

  upsertConnection(params: {
    projectId: string;
    connection: SiteForgeConnection;
    secret?: StoredConnectionSecret | null;
  }): Promise<SiteForgeConnection>;
  getProjectConnection(projectId: string): Promise<SiteForgeConnection | null>;
  getConnectionSecret(connectionId: string): Promise<StoredConnectionSecret | null>;
  saveProjectAiConfig(params: {
    projectId: string;
    provider: "openai";
    model: string;
    secret?: StoredAiSecret | null;
  }): Promise<void>;
  getProjectAiSecret(projectId: string): Promise<StoredAiSecret | null>;
  clearProjectAiSecret(projectId: string): Promise<void>;
  updateConnectionValidation(connectionId: string, patch: {
    status: ConnectionValidationStatus;
    thriveDetected: boolean;
    writeAccess: boolean;
    lastValidatedAt: string;
  }): Promise<void>;
  setProjectHomepageStrategy(projectId: string, strategy: HomepageStrategyMode): Promise<void>;

  createSession(session: BuildSession): Promise<BuildSession>;
  getSession(sessionId: string): Promise<BuildSession | null>;
  listSessions(projectId: string, userId: string): Promise<BuildSession[]>;
  updateSession(sessionId: string, patch: Partial<BuildSession>): Promise<void>;
  addRevision(sessionId: string, revision: BuildSession["revisionHistory"][number]): Promise<void>;
  appendRunLog(log: SiteForgeRunLog): Promise<void>;
  listRunLogs(projectId: string, userId: string): Promise<SiteForgeRunLog[]>;
  upsertSnapshot(snapshot: SiteForgeSnapshot): Promise<SiteForgeSnapshot>;
  getLatestSnapshot(projectId: string): Promise<SiteForgeSnapshot | null>;
  getWorkspace(projectId: string, userId: string): Promise<SiteForgeWorkspace | null>;

  appendFailure(sessionId: string, failure: SiteForgeFailureRecord): Promise<void>;
  getFailures(sessionId: string): Promise<SiteForgeFailureRecord[]>;

  getAdminSummary(): Promise<{
    projects: number;
    sessions: number;
    activeRuns: number;
    failedRuns: number;
    completedRuns: number;
    lastRunAt: string | null;
  } & SiteForgeStorageSummary>;
};
