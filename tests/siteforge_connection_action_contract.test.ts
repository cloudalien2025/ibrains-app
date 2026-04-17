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
    expect(source.includes("async function ensureCanonicalActiveProjectId(): Promise<string | null> {")).toBe(true);
    expect(source.includes("const targetProjectId = await ensureCanonicalActiveProjectId();")).toBe(true);
    expect(source.includes('setError("No active project selected.");')).toBe(true);
    expect(source.includes("setError(\"Selected project is out of sync. Reloading project state.\");")).toBe(true);
    expect(source.includes("`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/connection`")).toBe(true);
    expect(source.includes("disabled={busy || !selectedProjectId}")).toBe(true);
  });

  it("maps stale project-not-found responses to precise selected-project message", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(
      source.includes('(err.message === "Project not found." || err.message === "Project not found for current user.")')
    ).toBe(true);
    expect(source.includes('setError("Selected project could not be loaded.");')).toBe(true);
  });
});
