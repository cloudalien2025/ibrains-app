import { describe, expect, it } from "vitest";
import { isDirectoryIqConnector, toDirectoryIqStatus } from "../lib/directoryiq/signalSourceCredentials";

describe("DirectoryIQ signal source credentials", () => {
  it("returns persisted masked status for saved connectors", () => {
    const status = toDirectoryIqStatus([
      {
        connector_id: "brilliant_directories_api",
        label: "Primary",
        secret_last4: "ABCD",
        secret_length: 20,
        updated_at: "2026-02-28T00:00:00.000Z",
      },
    ]);

    const bd = status.find((s) => s.connector_id === "brilliant_directories_api");
    const openai = status.find((s) => s.connector_id === "openai");

    expect(bd?.connected).toBe(true);
    expect(bd?.masked_secret.endsWith("ABCD")).toBe(true);
    expect(openai?.connected).toBe(false);
  });

  it("accepts only supported DirectoryIQ connectors", () => {
    expect(isDirectoryIqConnector("brilliant_directories_api")).toBe(true);
    expect(isDirectoryIqConnector("openai")).toBe(true);
    expect(isDirectoryIqConnector("not_supported")).toBe(false);
  });
});
