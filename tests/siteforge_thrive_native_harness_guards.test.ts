import { afterEach, describe, expect, it } from "vitest";
import {
  assignTemplateToPost,
  createOrUpdateThriveSection,
  getThriveExecutionRuntime,
} from "@/lib/siteforge/thriveNativeHarness";
import { ConnectionProfile } from "@/lib/siteforge/contracts";

const baseConnection: ConnectionProfile = {
  id: "conn_1",
  label: "staging",
  baseUrl: "https://staging.example.com",
  username: "bot",
  appPassword: "pw",
};

afterEach(() => {
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING;
  delete process.env.SITEFORGE_THRIVE_STAGING_MARKER;
  delete process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION;
  delete process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST;
});

describe("siteforge thrive native harness guards", () => {
  it("keeps runtime in safe/intel mode by default", () => {
    const runtime = getThriveExecutionRuntime({ thriveIntelligenceAvailable: true });
    expect(runtime.wpSafeMode).toBe(true);
    expect(runtime.thriveIntelMode).toBe(true);
    expect(runtime.stagingNativeMode).toBe(false);
  });

  it("blocks native operation when staging flag is disabled", async () => {
    await expect(assignTemplateToPost({ connection: baseConnection, postId: 10, templateId: 20 })).rejects.toThrow(
      "Thrive native staging mode disabled"
    );
  });

  it("blocks native operation on live iPetzo-like hosts even with staging flags", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_THRIVE_STAGING_MARKER = "staging";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "ttb/v1/template";

    await expect(
      createOrUpdateThriveSection({
        connection: { ...baseConnection, baseUrl: "https://ipetzo.com" },
        sectionId: 7,
        name: "Header Section",
      })
    ).rejects.toThrow("Blocked live-site Thrive native operation");
  });
});
