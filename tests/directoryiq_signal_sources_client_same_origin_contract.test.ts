import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientPath = path.join(
  process.cwd(),
  "app/(brains)/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx"
);

describe("directoryiq signal-sources client same-origin contract", () => {
  it("does not depend on browser-direct external API base config", () => {
    const source = fs.readFileSync(clientPath, "utf8");

    expect(source).not.toContain("NEXT_PUBLIC_DIRECTORYIQ_API_BASE");
    expect(source).not.toMatch(/apiUrl\(/);
  });

  it("uses same-origin DirectoryIQ api paths", () => {
    const source = fs.readFileSync(clientPath, "utf8");

    expect(source).toContain('fetch("/api/directoryiq/signal-sources"');
    expect(source).toContain('fetch("/api/directoryiq/sites"');
    expect(source).toContain('fetch("/api/directoryiq/ingest/runs"');
    expect(source).toContain('fetch("/api/ingest/directoryiq/run"');
  });
});
