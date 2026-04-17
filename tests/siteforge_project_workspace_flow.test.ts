import { describe, expect, it } from "vitest";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import type { SiteForgeProject } from "@/lib/siteforge/contracts";

function makeProject(userId: string, index: number): SiteForgeProject {
  const now = new Date(Date.now() + index).toISOString();
  return {
    id: `sfp_flow_${userId}_${index}_${Date.now()}`,
    userId,
    name: `Flow Project ${index}`,
    slug: `flow-project-${index}`,
    status: "draft",
    siteType: null,
    primaryPrompt: null,
    currentState: "workspace",
    homepageStrategy: "use_existing",
    lastOpenedAt: null,
    description: "workspace flow test",
    latestSessionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("siteforge project workspace flow", () => {
  it("creates projects and restores last opened project pointer", async () => {
    const repo = await getSiteForgeRepository();
    const userId = `user_flow_${Date.now()}`;

    const project1 = makeProject(userId, 1);
    const project2 = makeProject(userId, 2);

    await repo.createProject(project1);
    await repo.createProject(project2);

    await repo.markProjectOpened(userId, project2.id);

    const lastOpened = await repo.getLastOpenedProjectId(userId);
    expect(lastOpened).toBe(project2.id);

    const listed = await repo.listProjects(userId);
    expect(listed.some((entry) => entry.id === project2.id)).toBe(true);
    expect(listed.find((entry) => entry.id === project2.id)?.lastOpenedAt).not.toBeNull();
  });

  it("persists project name updates for workspace hydration", async () => {
    const repo = await getSiteForgeRepository();
    const userId = `user_flow_name_${Date.now()}`;
    const project = makeProject(userId, 1);

    await repo.createProject(project);
    await repo.updateProject(project.id, {
      name: "Renamed Workspace Project",
      slug: "renamed-workspace-project",
      primaryPrompt: "build a strong conversion-focused homepage",
      websiteBrief: {
        businessName: "Acme",
        businessType: "Consulting",
        businessDescription: "Growth consulting",
        targetAudience: "Founders",
        websiteGoal: "book_calls",
        mainOffer: "Strategy sessions",
        brandTone: "expert",
        marketLocation: null,
        competitors: null,
        differentiators: "Faster execution",
      },
      currentState: "workspace",
    });

    const loaded = await repo.getProject(project.id, userId);
    expect(loaded?.name).toBe("Renamed Workspace Project");
    expect(loaded?.slug).toBe("renamed-workspace-project");
    expect(loaded?.primaryPrompt).toBe("build a strong conversion-focused homepage");
    expect(loaded?.websiteBrief?.businessName).toBe("Acme");

    const workspace = await repo.getWorkspace(project.id, userId);
    expect(workspace?.project.name).toBe("Renamed Workspace Project");
    expect(workspace?.project.websiteBrief?.mainOffer).toBe("Strategy sessions");
  });
});
