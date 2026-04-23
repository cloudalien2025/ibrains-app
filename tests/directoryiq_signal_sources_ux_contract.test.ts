import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq signal-sources ux contract", () => {
  it("keeps BD technical inputs behind advanced troubleshooting", () => {
    const filePath = path.join(
      process.cwd(),
      "app/apps/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("Add a site label, base URL, and API key.")).toBe(true);
    expect(source.includes("Advanced / Troubleshooting")).toBe(true);
    expect(source.includes("Listings Post Type ID (optional override)")).toBe(true);
    expect(source.includes("Blog Post Type ID (optional override)")).toBe(true);
  });

  it("marks unsupported non-BD connectors as unavailable and disables save flows", () => {
    const filePath = path.join(
      process.cwd(),
      "app/apps/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("Not yet available in this environment")).toBe(true);
    expect(source.includes("Coming soon for this environment. Save and Delete are disabled.")).toBe(true);
    expect(source.includes("disabled={saving === connectorId || !connectorReady}")).toBe(true);
    expect(source.includes("disabled={saving === connectorId || !state.connected || !connectorReady}")).toBe(true);
  });
});
