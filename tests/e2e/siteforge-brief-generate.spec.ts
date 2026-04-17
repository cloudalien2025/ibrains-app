import { expect, test } from "@playwright/test";

test.describe("SiteForge brief + AI generate flow", () => {
  test("submits structured brief and starts build", async ({ page }) => {
    const projectId = "p1";
    const sessionId = "s1";
    let lastBuildBody: Record<string, unknown> | null = null;

    const workspace = (hasSavedAiSecret: boolean) => ({
      project: {
        id: projectId,
        name: "Demo Project",
        slug: "demo-project",
        status: "draft",
        siteType: null,
        primaryPrompt: null,
        websiteBrief: null,
        currentState: "workspace",
        homepageStrategy: "use_existing",
        aiProvider: "openai",
        aiModel: "gpt-4.1-mini",
        aiSecretRef: hasSavedAiSecret ? "ref_1" : null,
        hasSavedAiSecret,
        lastOpenedAt: new Date().toISOString(),
        description: "x",
        latestSessionId: null,
        updatedAt: new Date().toISOString(),
      },
      activeConnection: null,
      snapshot: null,
      latestRun: null,
      runHistory: [],
      runLogs: [],
    });

    await page.route("**/api/siteforge/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (url.endsWith("/api/siteforge/projects") && method === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            projects: [workspace(false).project],
            lastOpenedProjectId: projectId,
          }),
        });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}`) && method === "PATCH") {
        await route.fulfill({ status: 200, body: JSON.stringify(workspace(false)) });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}/ai`) && method === "POST") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ workspace: workspace(true), ai: { provider: "openai", model: "gpt-4.1-mini", status: "saved" } }),
        });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}/build`) && method === "POST") {
        const data = req.postData();
        lastBuildBody = data ? (JSON.parse(data) as Record<string, unknown>) : null;
        await route.fulfill({
          status: 202,
          body: JSON.stringify({
            session: {
              id: sessionId,
              projectId,
              prompt: "synthesized",
              generationSource: "user_key",
              aiModel: "gpt-4.1-mini",
              connectionId: null,
              type: "generate",
              createdAt: new Date().toISOString(),
              status: "queued",
              runState: { currentStage: "planning", progressPct: 0, timeline: [] },
              buildSpec: null,
              executionResult: null,
              revisionHistory: [],
              errorSummary: null,
            },
          }),
        });
        return;
      }

      if (url.includes("/api/siteforge/sessions/") && method === "GET") {
        await route.fulfill({ status: 200, body: JSON.stringify({ session: null }) });
        return;
      }

      await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await page.goto("/apps/siteforge", { waitUntil: "networkidle" });

    await page.getByLabel("OpenAI API key").fill("sk-test");
    await page.getByRole("button", { name: "Save AI Key" }).click();

    await page.getByLabel("Business name").fill("Acme Labs");
    await page.getByLabel("Business type / category").fill("SaaS");
    await page.getByLabel("What does the business do?").fill("Sales pipeline software");
    await page.getByLabel("Who is the target audience?").fill("B2B sales leaders");
    await page.getByLabel("Main offer / service / product").fill("Pipeline automation suite");

    await page.getByRole("button", { name: "Generate My Website" }).click();

    await expect.poll(() => lastBuildBody).not.toBeNull();
    const websiteBrief = (lastBuildBody as Record<string, unknown>).websiteBrief as Record<string, unknown>;
    expect(websiteBrief.businessName).toBe("Acme Labs");
    expect(websiteBrief.mainOffer).toBe("Pipeline automation suite");
  });
});
