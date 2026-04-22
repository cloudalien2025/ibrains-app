import { expect, test } from "@playwright/test";

test.describe("SiteForge 2050 connect + describe flow", () => {
  test("connects first, then creates website plan from intent", async ({ page }) => {
    const projectId = "p1";
    const sessionId = "s1";
    let connectionValidated = false;
    let aiSaved = false;
    let savedWebsiteBrief: Record<string, unknown> | null = null;

    const workspace = (hasSavedAiSecret: boolean) => ({
      project: {
        id: projectId,
        name: "Demo Project",
        slug: "demo-project",
        status: "draft",
        siteType: null,
        primaryPrompt: null,
        websiteBrief: savedWebsiteBrief,
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
        const body = req.postDataJSON() as { websiteBrief?: Record<string, unknown> } | null;
        if (body?.websiteBrief) {
          savedWebsiteBrief = body.websiteBrief;
        }
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

      if (url.includes("/api/siteforge/projects/") && url.endsWith("/build") && method === "POST") {
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

    await page.getByPlaceholder("https://example.com").fill("https://example.com");
    await page.getByPlaceholder("WordPress username").fill("admin");
    await page.getByPlaceholder(/WordPress application password/i).fill("app-pass");
    await page.locator("#siteforge-ai-key").fill("sk-test");
    await page.getByTestId("siteforge-connect-website-action").click();
    await expect(page.getByText("Connected").first()).toBeVisible();

    await page.getByRole("button", { name: "Describe" }).click();
    await page.getByTestId("siteforge-intent-prompt").fill(intent);
    await page.getByTestId("siteforge-create-plan-action").click();
    await expect(page.getByText("Website plan ready.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve Homepage" })).toHaveCount(0);
    await expect(page.getByTestId("siteforge-intent-prompt")).toHaveValue(intent);
  });
});
