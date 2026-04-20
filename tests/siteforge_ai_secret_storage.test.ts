import { describe, expect, it } from "vitest";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import {
  clearProjectAiConfig,
  clearProjectSerpApiConfig,
  resolveProjectAiApiKey,
  resolveProjectSerpApiKey,
  saveProjectAiConfig,
  saveProjectSerpApiConfig,
} from "@/lib/siteforge/workspace";

function makeProject(id: string, userId: string) {
  const now = new Date().toISOString();
  return {
    id,
    userId,
    name: "AI Key Project",
    slug: "ai-key-project",
    status: "draft" as const,
    siteType: null,
    primaryPrompt: null,
    currentState: "workspace",
    homepageStrategy: "use_existing" as const,
    lastOpenedAt: now,
    description: "test",
    latestSessionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("siteforge AI secret storage", () => {
  it("saves, resolves, and clears project OpenAI key without exposing plaintext in project", async () => {
    const repo = await getSiteForgeRepository();
    const userId = `user_ai_${Date.now()}`;
    const projectId = `sfp_ai_${Date.now()}`;
    await repo.createProject(makeProject(projectId, userId));

    await saveProjectAiConfig({
      repo,
      projectId,
      model: "gpt-4.1-mini",
      apiKey: "sk-test-secret",
    });

    const loaded = await repo.getProject(projectId, userId);
    expect(loaded?.hasSavedAiSecret).toBe(true);
    expect(loaded?.aiSecretRef).toBeTruthy();
    expect((loaded as Record<string, unknown>)?.aiSecretCiphertext).toBeUndefined();

    const resolved = await resolveProjectAiApiKey({ repo, projectId });
    expect(resolved).toBe("sk-test-secret");

    await clearProjectAiConfig({ repo, projectId, model: "gpt-4.1-mini" });
    const afterClear = await repo.getProject(projectId, userId);
    expect(afterClear?.hasSavedAiSecret).toBe(false);
    expect(await resolveProjectAiApiKey({ repo, projectId })).toBeNull();
  });

  it("saves, resolves, and clears project SerpApi key without exposing plaintext in project", async () => {
    const repo = await getSiteForgeRepository();
    const userId = `user_serp_${Date.now()}`;
    const projectId = `sfp_serp_${Date.now()}`;
    await repo.createProject(makeProject(projectId, userId));

    await saveProjectSerpApiConfig({
      repo,
      projectId,
      apiKey: "serpapi-test-secret",
    });

    const loaded = await repo.getProject(projectId, userId);
    expect(loaded?.hasSavedSerpApiSecret).toBe(true);
    expect(loaded?.serpApiSecretRef).toBeTruthy();
    expect((loaded as Record<string, unknown>)?.serpApiSecretCiphertext).toBeUndefined();

    const resolved = await resolveProjectSerpApiKey({ repo, projectId });
    expect(resolved).toBe("serpapi-test-secret");

    await clearProjectSerpApiConfig({ repo, projectId });
    const afterClear = await repo.getProject(projectId, userId);
    expect(afterClear?.hasSavedSerpApiSecret).toBe(false);
    expect(await resolveProjectSerpApiKey({ repo, projectId })).toBeNull();
  });
});
