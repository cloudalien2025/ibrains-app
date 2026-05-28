import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("siteforge connection orchestration contract", () => {
  it("keeps canonical active project binding and orchestrated connect flow", () => {
    const sourcePath = path.join(process.cwd(), "app/pagebolt/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("const activeProjectId = activeProject?.id ?? null;")).toBe(true);
    expect(source.includes("const hasValidActiveProject = Boolean(activeProjectId && selectedProjectId === activeProjectId);")).toBe(true);
    expect(source.includes("async function ensureCanonicalActiveProjectId(): Promise<string | null> {")).toBe(true);
    expect(source.includes("async function connectAndBegin() {")).toBe(true);
    expect(source.includes("await saveAiConfig(\"save\");")).toBe(true);
    expect(source.includes("await saveAndValidateConnection();")).toBe(true);
    expect(source.includes("`/api/siteforge/projects/${encodeURIComponent(targetProjectId)}/connection`")).toBe(true);
  });

  it("maps stale project-not-found responses to precise selected-project message", () => {
    const sourcePath = path.join(process.cwd(), "app/pagebolt/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes('if (text.includes("project not found")) return "Selected project could not be loaded.";')).toBe(true);
  });
});
