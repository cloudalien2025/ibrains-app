import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const GUARD = path.join(process.cwd(), "scripts/guard-untracked-pull-conflicts.sh");

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function commitAll(repo: string, message: string): void {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", message]);
}

function runGuard(deployPath: string, targetRef: string): string {
  return execFileSync("bash", [GUARD, deployPath, targetRef], { encoding: "utf8" });
}

describe("guard-untracked-pull-conflicts.sh", () => {
  let root = "";
  let origin = "";
  let deploy = "";
  let branch = "";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "untracked-guard-"));
    origin = path.join(root, "origin");
    deploy = path.join(root, "deploy");

    fs.mkdirSync(origin);
    git(origin, ["init", "-q"]);
    git(origin, ["config", "user.email", "test@example.com"]);
    git(origin, ["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(origin, ".gitignore"), "secret.env\n");
    fs.writeFileSync(path.join(origin, "keep.txt"), "base\n");
    commitAll(origin, "base");
    branch = git(origin, ["rev-parse", "--abbrev-ref", "HEAD"]);

    // Deploy checkout is created at the base commit (before the scaffold lands).
    git(root, ["clone", "-q", origin, deploy]);
    git(deploy, ["config", "user.email", "test@example.com"]);
    git(deploy, ["config", "user.name", "Test"]);

    // Upstream then adds a file that the deploy checkout already has as a stray
    // untracked file — the exact shape that blocks `git pull --ff-only`.
    fs.mkdirSync(path.join(origin, "app/fileiq"), { recursive: true });
    fs.writeFileSync(path.join(origin, "app/fileiq/skeleton.ts"), "export const canonical = true;\n");
    commitAll(origin, "add fileiq skeleton");

    git(deploy, ["fetch", "-q", "origin"]);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("removes an untracked file that the incoming pull would overwrite, and the pull then succeeds", () => {
    fs.mkdirSync(path.join(deploy, "app/fileiq"), { recursive: true });
    fs.writeFileSync(path.join(deploy, "app/fileiq/skeleton.ts"), "stale scaffold\n");

    // Sanity: without the guard, an ff-only pull is blocked by the untracked file.
    expect(() => git(deploy, ["pull", "--ff-only", "origin", branch])).toThrow();

    const out = runGuard(deploy, `origin/${branch}`);
    expect(out).toContain("removing app/fileiq/skeleton.ts");
    expect(out).toContain("removed 1 conflicting untracked file(s)");
    expect(fs.existsSync(path.join(deploy, "app/fileiq/skeleton.ts"))).toBe(false);

    // Pull now succeeds and restores the canonical tracked version (lossless).
    git(deploy, ["pull", "--ff-only", "origin", branch]);
    expect(fs.readFileSync(path.join(deploy, "app/fileiq/skeleton.ts"), "utf8")).toBe(
      "export const canonical = true;\n",
    );
  });

  it("preserves untracked files that are not present in the target ref", () => {
    fs.writeFileSync(path.join(deploy, "local-only.txt"), "keep me\n");

    const out = runGuard(deploy, `origin/${branch}`);
    expect(out).toContain("removed 0 conflicting untracked file(s)");
    expect(fs.existsSync(path.join(deploy, "local-only.txt"))).toBe(true);
  });

  it("never touches gitignored files even when a same-named path exists upstream", () => {
    fs.writeFileSync(path.join(deploy, "secret.env"), "API_KEY=local\n");

    runGuard(deploy, `origin/${branch}`);
    // secret.env is ignored, so it is never a pull conflict and must remain.
    expect(fs.readFileSync(path.join(deploy, "secret.env"), "utf8")).toBe("API_KEY=local\n");
  });

  it("fails clearly when the target ref has not been fetched", () => {
    expect(() => runGuard(deploy, "origin/does-not-exist")).toThrow(/target ref not found/);
  });
});
