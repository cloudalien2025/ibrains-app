import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { shouldPersistProjectName } from "@/lib/siteforge/projectNameAutosave";

describe("siteforge project editor contract", () => {
  it("auto-save persists only when active project name changes to non-empty value", () => {
    expect(
      shouldPersistProjectName({
        selectedProjectId: "p1",
        projectName: "Renamed Project",
        persistedProjectName: "Old Project",
      })
    ).toBe(true);

    expect(
      shouldPersistProjectName({
        selectedProjectId: "",
        projectName: "Renamed Project",
        persistedProjectName: "Old Project",
      })
    ).toBe(false);

    expect(
      shouldPersistProjectName({
        selectedProjectId: "p1",
        projectName: "   ",
        persistedProjectName: "Old Project",
      })
    ).toBe(false);

    expect(
      shouldPersistProjectName({
        selectedProjectId: "p1",
        projectName: "Same Name",
        persistedProjectName: "Same Name",
      })
    ).toBe(false);
  });

  it("does not render manual Save Project button in SiteForge page", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Save Project")).toBe(false);
  });

  it("renders rename editor only for active project and not as a create field", () => {
    const sourcePath = path.join(process.cwd(), "app/apps/siteforge/page.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source.includes("Rename current project")).toBe(true);
    expect(source.includes("New project name")).toBe(true);
    expect(source.includes("Loading selected project...")).toBe(true);
  });
});
