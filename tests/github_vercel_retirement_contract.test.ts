import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listWorkflowFiles() {
  const workflowsDir = path.join(process.cwd(), ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => path.join(workflowsDir, name));
}

describe("GitHub Vercel retirement contract", () => {
  it("keeps Vercel out of active GitHub workflow and package deployment config", () => {
    expect(fs.existsSync(path.join(process.cwd(), "vercel.json"))).toBe(false);

    for (const workflowPath of listWorkflowFiles()) {
      const workflow = fs.readFileSync(workflowPath, "utf8");
      expect(workflow.toLowerCase()).not.toContain("vercel");
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = Object.values(packageJson.scripts ?? {}).join("\n").toLowerCase();
    expect(scripts).not.toContain("vercel");
  });
});
