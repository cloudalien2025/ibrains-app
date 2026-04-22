import { expect, test } from "@playwright/test";

test.describe("SiteForge 2050 describe + connect flow", () => {
  test("creates direction from intent and starts preview build", async ({ page }) => {
    const projectId = "p1";
    const sessionId = "s1";
    let lastBuildBody: Record<string, unknown> | null = null;
    let connectionValidated = false;
    let aiSaved = false;

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
        serpApiProvider: "serpapi",
        serpApiSecretRef: null,
        hasSavedSerpApiSecret: false,
        lastOpenedAt: new Date().toISOString(),
        description: "x",
        latestSessionId: null,
        updatedAt: new Date().toISOString(),
      },
      activeConnection: connectionValidated
        ? {
            connectionId: "c1",
            projectId,
            label: "Primary WordPress Site",
            wordpressUrl: "https://example.com",
            username: "admin",
            authType: "application_password",
            secretRef: "secret_1",
            hasSavedSecret: true,
            thriveDetected: true,
            writeAccess: true,
            lastValidatedAt: new Date().toISOString(),
            lastValidationStatus: "valid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : null,
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
        await route.fulfill({ status: 200, body: JSON.stringify(workspace(aiSaved)) });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}/ai`) && method === "POST") {
        aiSaved = true;
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

      if (url.endsWith(`/api/siteforge/projects/${projectId}/connection`) && method === "POST") {
        connectionValidated = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            result: {
              connected: true,
              canWritePages: true,
              canManageSettings: true,
              thriveDetected: true,
              thriveSignals: ["thrive_theme"],
              message: "Connection validated and saved.",
            },
            connection: workspace(false).activeConnection,
            credentialsSaved: true,
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

    const intent = "Build a high-converting homepage for my AI pet app.";

    await page.goto("/apps/siteforge", { waitUntil: "networkidle" });
    await page.getByTestId("siteforge-intent-prompt").fill(intent);
    await page.getByTestId("siteforge-create-direction-action").click();

    await page.getByPlaceholder("https://example.com").fill("https://example.com");
    await page.getByPlaceholder("WordPress username").fill("admin");
    await page.getByPlaceholder(/WordPress application password/i).fill("app-pass");
    await page.locator("#siteforge-ai-key").fill("sk-test");

    await page.getByTestId("siteforge-connect-begin-action").click();

    await expect.poll(() => lastBuildBody).not.toBeNull();
    const websiteBrief = (lastBuildBody as Record<string, unknown>).websiteBrief as Record<string, unknown>;
    expect(websiteBrief.businessDescription).toBe(intent);
    expect(websiteBrief.mainOffer).toBe("Primary offer with clear conversion path");
    expect((lastBuildBody as Record<string, unknown>).homepageStrategy).toBe("draft_only");
  });
});
