import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("siteforge active project override guard contract", () => {
  it("locks active project intent after create and blocks stale load override paths", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("const activeProjectIntentRef = useRef<string | null>(null);")).toBe(true);
    expect(source.includes("activeProjectIntentRef.current = normalized.project.id;")).toBe(true);
    expect(source.includes('const opened = await openProject(normalized.project.id, "create");')).toBe(true);
    expect(source.includes("if (source === \"load\" && intentId && intentId !== projectId) {")).toBe(true);
    expect(source.includes("intendedProjectId && data.projects.some((project) => project.id === intendedProjectId)")).toBe(true);
    expect(source.includes("if (activeProjectIntentRef.current && candidate.id !== activeProjectIntentRef.current) continue;")).toBe(
      true
    );
  });

  it("does not render project selector fallback in default user shell", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("selectedProjectId && !selectedProjectInOptions")).toBe(false);
    expect(source.includes("<option value={selectedProjectId}>Loading selected project...</option>")).toBe(false);
  });
});
