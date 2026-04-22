import { expect, test } from "@playwright/test";

test.describe("SiteForge brief + AI generate flow", () => {
  test("submits structured brief and starts build", async ({ page }) => {
    const projectId = "p1";
    const sessionId = "s1";
    let lastBuildBody: Record<string, unknown> | null = null;
    let connectionValidated = false;

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

    await page.goto("/apps/siteforge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByPlaceholder("https://example.com").fill("https://example.com");
    await page.getByPlaceholder("WordPress username").fill("admin");
    await page.getByPlaceholder(/WordPress application password/i).fill("app-pass");
    await page.getByTestId("siteforge-validate-connection-action").click();

    await page.locator("#siteforge-ai-key").fill("sk-test");
    await page.getByRole("button", { name: "Save API Keys" }).click();

    await page.locator("#siteforge-brief-business-name").fill("Acme Labs");
    await page.locator("#siteforge-brief-business-type").fill("SaaS");
    await page.locator("#siteforge-brief-business-description").fill("Sales pipeline software");
    await page.locator("#siteforge-brief-target-audience").fill("B2B sales leaders");
    await page.locator("#siteforge-brief-main-offer").fill("Pipeline automation suite");
    await page.getByTestId("siteforge-business-continue-action").click();
    await page.getByPlaceholder("Describe what you want to build or improve...").fill("Build my first draft website.");
    await page.getByTestId("siteforge-generate-site-action").click();

    await expect.poll(() => lastBuildBody).not.toBeNull();
    const websiteBrief = (lastBuildBody as Record<string, unknown>).websiteBrief as Record<string, unknown>;
    expect(websiteBrief.businessName).toBe("Acme Labs");
    expect(websiteBrief.mainOffer).toBe("Pipeline automation suite");
    expect((lastBuildBody as Record<string, unknown>).homepageStrategy).toBe("draft_only");
  });
});
