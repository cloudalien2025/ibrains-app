import { BuildSession, SiteForgeProject } from "@/lib/siteforge/contracts";

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

  createSession(session: BuildSession): Promise<BuildSession>;
  getSession(sessionId: string): Promise<BuildSession | null>;
  listSessions(projectId: string, userId: string): Promise<BuildSession[]>;
  updateSession(sessionId: string, patch: Partial<BuildSession>): Promise<void>;
  addRevision(sessionId: string, revision: BuildSession["revisionHistory"][number]): Promise<void>;

  appendFailure(sessionId: string, failure: SiteForgeFailureRecord): Promise<void>;
  getFailures(sessionId: string): Promise<SiteForgeFailureRecord[]>;

  getAdminSummary(): Promise<{
    projects: number;
    sessions: number;
    activeRuns: number;
    failedRuns: number;
    completedRuns: number;
    lastRunAt: string | null;
    storageMode: "postgres" | "memory";
  }>;
};
