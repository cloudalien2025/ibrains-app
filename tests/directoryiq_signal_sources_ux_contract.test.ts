import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq signal-sources ux contract", () => {
  it("keeps BD technical inputs behind advanced troubleshooting", () => {
    const filePath = path.join(
      process.cwd(),
      "app/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("Add a site label, base URL, and API key.")).toBe(true);
    expect(source.includes("Advanced / Troubleshooting")).toBe(true);
    expect(source.includes("Listings Post Type ID (optional override)")).toBe(true);
    expect(source.includes("Blog Post Type ID (optional override)")).toBe(true);
  });

  it("uses backend-readiness messaging for non-BD connectors and keeps save gating tied to readiness", () => {
    const filePath = path.join(
      process.cwd(),
      "app/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("Credential storage backend is currently unavailable")).toBe(true);
    expect(source.includes("Save and Delete are disabled until credential storage is available.")).toBe(true);
    expect(source.includes("Coming soon for this environment. Save and Delete are disabled.")).toBe(false);
    expect(source.includes("disabled={saving === connectorId || !connectorReady}")).toBe(true);
    expect(source.includes("disabled={saving === connectorId || !state.connected || !connectorReady}")).toBe(true);
  });
});
