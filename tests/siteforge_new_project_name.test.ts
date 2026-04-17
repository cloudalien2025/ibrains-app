import { describe, expect, it } from "vitest";
import { normalizeNewProjectName } from "@/lib/siteforge/newProjectName";

describe("siteforge new project name", () => {
  it("accepts a typed name directly for project creation", () => {
    expect(normalizeNewProjectName("iPetzo")).toBe("iPetzo");
    expect(normalizeNewProjectName("  iPetzo Pro  ")).toBe("iPetzo Pro");
  });

  it("rejects empty or whitespace-only names", () => {
    expect(normalizeNewProjectName("")).toBeNull();
    expect(normalizeNewProjectName("   ")).toBeNull();
  });
});
