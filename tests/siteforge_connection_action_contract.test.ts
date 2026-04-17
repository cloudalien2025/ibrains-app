import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("siteforge connection action contract", () => {
  it("requires canonical active project binding for save + validate", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("const activeProjectId = activeProject?.id ?? null;")).toBe(true);
    expect(source.includes("const hasValidActiveProject = Boolean(activeProjectId && selectedProjectId === activeProjectId);")).toBe(
      true
    );
    expect(source.includes("if (!hasValidActiveProject || !activeProjectId) {")).toBe(true);
    expect(source.includes('setError("No active project selected.");')).toBe(true);
    expect(source.includes("`/api/siteforge/projects/${encodeURIComponent(activeProjectId)}/connection`")).toBe(true);
    expect(source.includes("disabled={busy || !hasValidActiveProject}")).toBe(true);
  });

  it("maps stale project-not-found responses to precise selected-project message", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('if (err instanceof Error && err.message === "Project not found.") {')).toBe(true);
    expect(source.includes('setError("Selected project could not be loaded.");')).toBe(true);
  });
});
