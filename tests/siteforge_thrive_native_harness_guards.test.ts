import { afterEach, describe, expect, it } from "vitest";
import { assignTemplateToPost, createOrUpdateThriveSection, evaluateThriveNativeGuard, getThriveExecutionRuntime } from "@/lib/siteforge/thriveNativeHarness";
import { ConnectionProfile } from "@/lib/siteforge/contracts";

const baseConnection: ConnectionProfile = {
  id: "conn_1",
  label: "staging",
  baseUrl: "https://staging.example.com",
  username: "bot",
  appPassword: "pw",
};

afterEach(() => {
  process.env.NODE_ENV = "test";
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING;
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE;
  delete process.env.SITEFORGE_APPROVED_NATIVE_TARGETS;
  delete process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION;
  delete process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST;
  delete process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST;
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
      "native_flag_disabled"
    );
  });

  it("recognizes ipetzo.com as approved target when explicitly allowlisted", () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "ipetzo.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_section";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST = "createOrUpdateSection";

    const guard = evaluateThriveNativeGuard({
      ...baseConnection,
      baseUrl: "https://ipetzo.com",
    });
    expect(guard.eligible).toBe(true);
    expect(guard.nativeTargetMode).toBe("approved_non_production_target");
    expect(guard.approvedTargetHost).toBe("ipetzo.com");
    expect(guard.approvalSource).toBe("env_allowlist");
  });

  it("blocks unapproved targets", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "ipetzo.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_section";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST = "createOrUpdateSection";

    await expect(
      createOrUpdateThriveSection({
        connection: { ...baseConnection, baseUrl: "https://staging.example.com" },
        sectionId: 7,
        name: "Header Section",
      })
    ).rejects.toThrow("blocked_unapproved_target");
  });

  it("blocks native operation in production environment", async () => {
    process.env.NODE_ENV = "production";
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/pages";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST = "assignTemplateToPost";

    await expect(assignTemplateToPost({ connection: baseConnection, postId: 10, templateId: 20 })).rejects.toThrow(
      "production_environment_block"
    );

    process.env.NODE_ENV = "test";
  });
});
