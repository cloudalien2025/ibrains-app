import { describe, expect, it } from "vitest";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { createInitialRunState } from "@/lib/siteforge/orchestrator";
import type { BuildSession, SiteForgeProject } from "@/lib/siteforge/contracts";

describe("siteforge repository", () => {
  it("persists project and session data", async () => {
    const repo = await getSiteForgeRepository();

    const now = new Date().toISOString();
    const project: SiteForgeProject = {
      id: `sfp_test_${Date.now()}`,
      userId: "user_test",
      name: "Test Project",
      slug: "test-project",
      status: "draft",
      siteType: null,
      primaryPrompt: null,
      currentState: "workspace",
      homepageStrategy: "use_existing",
      lastOpenedAt: now,
      description: "SiteForge project",
      latestSessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createProject(project);
    const projects = await repo.listProjects("user_test");
    expect(projects.some((entry) => entry.id === project.id)).toBe(true);

    const session: BuildSession = {
      id: `sfs_test_${Date.now()}`,
      projectId: project.id,
      userId: "user_test",
      connectionId: null,
      type: "generate",
      triggerSource: "user",
      prompt: "Build a SaaS website",
      connectionProfile: null,
      status: "queued",
      runState: createInitialRunState(),
      sitePlan: null,
      contentPackage: null,
      buildSpec: null,
      qaResult: null,
      executionResult: null,
      revisionHistory: [],
      errorSummary: null,
      startedAt: now,
      completedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createSession(session);
    await repo.updateSession(session.id, { status: "running" });

    const loaded = await repo.getSession(session.id);
    expect(loaded?.status).toBe("running");

    const summary = await repo.getAdminSummary();
    expect(summary.sessions).toBeGreaterThan(0);
  });

  it("does not clobber project name when update patch includes undefined fields", async () => {
    const repo = await getSiteForgeRepository();
    const userId = `user_test_patch_${Date.now()}`;
    const now = new Date().toISOString();
    const projectId = `sfp_test_patch_${Date.now()}`;

    await repo.createProject({
      id: projectId,
      userId,
      name: "iPetzo",
      slug: "ipetzo",
      status: "draft",
      siteType: null,
      primaryPrompt: null,
      currentState: "workspace",
      homepageStrategy: "use_existing",
      lastOpenedAt: now,
      description: "patch safety test",
      latestSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    await repo.updateProject(projectId, { name: undefined, currentState: "workspace" } as unknown as Partial<SiteForgeProject>);

    const loaded = await repo.getProject(projectId, userId);
    expect(loaded?.name).toBe("iPetzo");
  });
});
