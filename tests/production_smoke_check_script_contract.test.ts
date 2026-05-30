import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production smoke check script contract", () => {
  it("includes required route timing and operational diagnostics checks", () => {
    const scriptPath = path.join(process.cwd(), "scripts/production_smoke_check.sh");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const source = fs.readFileSync(scriptPath, "utf8");

    expect(source).toContain("systemctl");
    expect(source).toContain("journalctl");
    expect(source).toContain("/var/log/nginx/error.log");
    expect(source).toContain("/var/log/nginx/app.ibrains.ai.error.log");
    expect(source).toContain("/var/log/ibrains-app/app.log");
    expect(source).toContain("ss -tan state close-wait");
    expect(source).toContain("check_release_metadata_non_null");

    expect(source).toContain('check_route_timing "/api/health"');
    expect(source).toContain('check_route_timing "/api/meta/release"');
    expect(source).toContain('check_route_timing "/brains"');
    expect(source).toContain('check_route_timing "/ecomviper"');
    expect(source).toContain('check_route_timing "/ecomviper/settings"');
    expect(source).toContain('check_route_timing "/ecomviper/dropshipping/rocktomic"');
    expect(source).toContain("prod_smoke.sh");
  });
});
