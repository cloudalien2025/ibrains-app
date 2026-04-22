import { expect, test } from "@playwright/test";

test.describe("SiteForge step navigation + connect flow", () => {
  test("keeps Connect/Describe/Launch clickable and runs connect website", async ({ page }) => {
    const projectId = "p1";
    let aiSaved = false;
    let connectionValidated = false;

    const workspace = () => ({
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
        aiSecretRef: aiSaved ? "ref_1" : null,
        hasSavedAiSecret: aiSaved,
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

      if (url.endsWith("/api/siteforge/admin/summary")) {
        await route.fulfill({ status: 200, body: JSON.stringify({ summary: { storageMode: "postgres", persistenceHealth: "healthy", fallbackAllowed: true, fallbackActive: false, reason: null } }) });
        return;
      }

      if (url.endsWith("/api/siteforge/projects") && method === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            projects: [workspace().project],
            lastOpenedProjectId: projectId,
          }),
        });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}`) && method === "PATCH") {
        await route.fulfill({ status: 200, body: JSON.stringify(workspace()) });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}/ai`) && method === "POST") {
        aiSaved = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ workspace: workspace(), ai: { provider: "openai", model: "gpt-4.1-mini", status: "saved" } }),
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
            connection: workspace().activeConnection,
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

    await expect(page.getByText("Advanced")).toHaveCount(0);

    await page.getByRole("button", { name: "Describe" }).click();
    await expect(page.getByRole("heading", { name: "Describe" })).toBeVisible();

    await page.getByRole("button", { name: "Launch" }).click();
    await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();

    await page.getByPlaceholder("https://example.com").fill("https://example.com");
    await page.getByPlaceholder("WordPress username").fill("admin");
    await page.getByPlaceholder(/application password/i).fill("app-pass");
    await page.locator("#siteforge-ai-key").fill("sk-test");

    const connectResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response.url().includes(`/api/siteforge/projects/${encodeURIComponent(projectId)}/connection`)
      );
    });

    await page.getByTestId("siteforge-connect-website-action").click();
    const connectResponse = await connectResponsePromise;

    expect(connectResponse.status()).toBe(200);
    await expect(page.getByText("Connected").first()).toBeVisible();
  });
});
