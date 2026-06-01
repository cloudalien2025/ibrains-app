import { describe, expect, it, vi } from "vitest";

describe("supplier toolbelt doctor", () => {
  it("masks firecrawl env and reports cache check", async () => {
    process.env.FIRECRAWL_API_KEY = "supersecret";

    vi.doMock("node:child_process", () => ({
      execFile: (cmd: string, _args: string[], cb: (error: unknown, stdout: string, stderr: string) => void) => {
        if (cmd === "npm") return cb(null, "10.0.0", "");
        if (cmd === "bash") return cb(null, "/usr/bin/mock", "");
        if (cmd === "node") return cb(null, "", "");
        if (cmd === "python3") return cb(null, "", "");
        return cb(new Error("missing"), "", "");
      },
    }));

    const mod = await import("@/lib/ecomviper/suppliers/supplier-toolbelt-doctor");
    const report = await mod.runSupplierToolbeltDoctor();

    const env = report.checks.find((check) => check.key === "firecrawl_env");
    expect(env?.detail).toMatch(/^set\(len=/);
    expect(report.checks.some((check) => check.key === "firecrawl_cache_dir")).toBe(true);

    vi.resetModules();
    vi.doUnmock("node:child_process");
  });
});
