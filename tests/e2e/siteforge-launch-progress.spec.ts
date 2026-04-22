import { expect, test } from "@playwright/test";

test.describe("SiteForge launch progress", () => {
  test("shows progress stages, in-progress button state, completion state, and mobile usability", async ({ page }) => {
    const projectId = "p1";
    const sessionId = "s1";
    let latestSession: Record<string, unknown> | null = null;
    let sessionPollCount = 0;

    const now = () => new Date().toISOString();

    const baseProject = {
      id: projectId,
      name: "Demo Project",
      slug: "demo-project",
      status: "draft",
      siteType: null,
      primaryPrompt: null,
      websiteBrief: {
        businessName: "iPetzo",
        businessType: "Pet app",
        businessDescription: "Pet records and reminders app",
        targetAudience: "Pet parents",
        websiteGoal: "drive_demos_trials",
        mainOffer: "Pet care command center",
        brandTone: "premium",
        marketLocation: null,
        competitors: null,
        differentiators: "Grounded guidance",
      },
      currentState: "workspace",
      homepageStrategy: "use_existing",
      aiProvider: "openai",
      aiModel: "gpt-4.1-mini",
      aiSecretRef: "ref_1",
      hasSavedAiSecret: true,
      serpApiProvider: "serpapi",
      serpApiSecretRef: null,
      hasSavedSerpApiSecret: false,
      lastOpenedAt: now(),
      description: "x",
      latestSessionId: sessionId,
      updatedAt: now(),
    };

    const activeConnection = {
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
      lastValidatedAt: now(),
      lastValidationStatus: "valid",
      createdAt: now(),
      updatedAt: now(),
    };

    const workspace = () => ({
      project: baseProject,
      activeConnection,
      snapshot: null,
      latestRun: latestSession,
      runHistory: latestSession ? [latestSession] : [],
      runLogs: [],
    });

    await page.route("**/api/siteforge/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (url.endsWith("/api/siteforge/admin/summary")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ summary: { storageMode: "postgres", persistenceHealth: "healthy", fallbackAllowed: false, fallbackActive: false, reason: null } }),
        });
        return;
      }

      if (url.endsWith("/api/siteforge/projects") && method === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ projects: [baseProject], lastOpenedProjectId: projectId }),
        });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}`) && method === "PATCH") {
        await route.fulfill({ status: 200, body: JSON.stringify(workspace()) });
        return;
      }

      if (url.endsWith(`/api/siteforge/projects/${projectId}/build`) && method === "POST") {
        latestSession = {
          id: sessionId,
          projectId,
          prompt: "build",
          generationSource: "user_key",
          aiModel: "gpt-4.1-mini",
          connectionId: "c1",
          type: "generate",
          createdAt: now(),
          status: "queued",
          runState: {
            currentStage: "planning",
            progressPct: 2,
            timeline: [{ at: now(), stage: "planning", message: "Build queued", level: "info" }],
          },
          buildSpec: null,
          executionResult: null,
          revisionHistory: [],
          errorSummary: null,
        };
        await route.fulfill({ status: 202, body: JSON.stringify({ session: latestSession }) });
        return;
      }

      if (url.includes(`/api/siteforge/sessions/${sessionId}`) && method === "GET") {
        sessionPollCount += 1;
        if (sessionPollCount === 1) {
          latestSession = {
            ...latestSession,
            status: "running",
            runState: {
              currentStage: "writing",
              progressPct: 40,
              timeline: [
                { at: now(), stage: "planning", message: "Build queued", level: "info" },
                { at: now(), stage: "planning", message: "Planning your site structure", level: "info" },
                { at: now(), stage: "writing", message: "Writing conversion-focused page content", level: "info" },
              ],
            },
          };
        } else {
          latestSession = {
            ...latestSession,
            status: "completed",
            runState: {
              currentStage: "completed",
              progressPct: 100,
              timeline: [
                { at: now(), stage: "planning", message: "Build queued", level: "info" },
                { at: now(), stage: "completed", message: "Build run completed", level: "info" },
              ],
            },
            executionResult: {
              success: true,
              createdPages: [{ slug: "home", status: "created", url: "https://example.com/home" }],
              homepage: { success: true, message: "ok", title: "Home" },
              menu: { success: true, message: "ok" },
              thrive: {
                enabled: true,
                appliedMappings: [],
                fallbackUsed: false,
                buildModeUsed: "thrive_native",
              },
            },
            buildSpec: { siteTitle: "iPetzo", pages: [{ title: "Home", slug: "home", sections: [] }] },
          };
        }

        await route.fulfill({ status: 200, body: JSON.stringify({ session: latestSession }) });
        return;
      }

      await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/apps/siteforge", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Launch" }).click();

    const buildButton = page.getByTestId("siteforge-build-website-action");
    await expect(buildButton).toBeVisible();
    await buildButton.click();

    await expect(page.getByTestId("siteforge-build-progress-bar")).toBeVisible();
    await expect(page.getByTestId("siteforge-build-stage-list")).toContainText("Preparing your build");
    await expect(page.getByTestId("siteforge-build-stage-list")).toContainText("Designing your layout");
    await expect(buildButton).toBeDisabled();
    await expect(buildButton).toHaveText("Building...");

    await expect(page.getByText("Draft ready").first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("link", { name: "View Draft in Thrive" })).toBeVisible();
  });
});
