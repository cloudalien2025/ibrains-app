import { afterEach, describe, expect, it, vi } from "vitest";
import { executeThriveNativePlan, rollbackThriveNativeExecution } from "@/lib/siteforge/thriveNativeHarness";
import { ConnectionProfile } from "@/lib/siteforge/contracts";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const connection: ConnectionProfile = {
  id: "conn_1",
  label: "staging",
  baseUrl: "https://staging.example.com",
  username: "bot",
  appPassword: "pw",
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING;
  delete process.env.SITEFORGE_ENABLE_THRIVE_NATIVE;
  delete process.env.SITEFORGE_APPROVED_NATIVE_TARGETS;
  delete process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION;
  delete process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST;
  delete process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST;
});

describe("siteforge thrive native execution + rollback", () => {
  it("executes approved operations with verification and tracks rollback candidates", async () => {
    process.env.SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING = "1";
    process.env.SITEFORGE_APPROVED_NATIVE_TARGETS = "staging.example.com";
    process.env.SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION = "v1";
    process.env.SITEFORGE_THRIVE_ROUTE_ALLOWLIST = "/wp-json/wp/v2/thrive_template,/wp-json/wp/v2/thrive_section";
    process.env.SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST = "createOrUpdateTemplateShellReference,createOrUpdateSection";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (init?.method === "POST" && url.includes("/wp-json/wp/v2/thrive_template")) {
          return json({ id: 300, slug: "acme-homepage-shell" }, 200);
        }
        if (init?.method === "GET" && url.includes("/wp-json/wp/v2/thrive_template/300")) {
          return json({ id: 300, slug: "acme-homepage-shell" }, 200);
        }
        if (init?.method === "POST" && url.includes("/wp-json/wp/v2/thrive_section")) {
          return json({ id: 301, slug: "acme-cta" }, 200);
        }
        if (init?.method === "GET" && url.includes("/wp-json/wp/v2/thrive_section/301")) {
          return json({ id: 301, slug: "acme-cta" }, 200);
        }
        if (init?.method === "DELETE" && (url.includes("/wp-json/wp/v2/thrive_template/300") || url.includes("/wp-json/wp/v2/thrive_section/301"))) {
          return json({ deleted: true }, 200);
        }

        throw new Error(`Unhandled request ${init?.method ?? "GET"} ${url}`);
      }) as unknown as typeof fetch
    );

    const execution = await executeThriveNativePlan({
      connection,
      mode: "thrive_native_staging_mode",
      operations: [
        {
          operation: "createOrUpdateTemplateShellReference",
          payload: {
            title: "Acme Homepage Shell",
            slug: "acme-homepage-shell",
            shellLayoutCandidate: "thrive-homepage-canonical",
          },
        },
        {
          operation: "createOrUpdateSection",
          payload: {
            title: "Acme CTA",
            slug: "acme-cta",
          },
        },
      ],
    });

    expect(execution.success).toBe(true);
    expect(execution.steps).toHaveLength(2);
    expect(execution.steps.every((step) => step.verificationPassed)).toBe(true);
    expect(execution.rollback.available).toBe(true);
    expect(execution.createdObjects.map((entry) => entry.id)).toEqual([300, 301]);

    const rollback = await rollbackThriveNativeExecution({ connection, execution });
    expect(rollback.available).toBe(true);
    expect(rollback.steps.every((step) => step.attempted)).toBe(true);
    expect(rollback.steps.every((step) => step.success)).toBe(true);
  });

  it("returns blocked mode when guards fail", async () => {
    const execution = await executeThriveNativePlan({
      connection,
      mode: "thrive_native_staging_mode",
      operations: [
        {
          operation: "createOrUpdateSection",
          payload: { title: "Acme", slug: "acme" },
        },
      ],
    });

    expect(execution.mode).toBe("blocked_native_mode");
    expect(execution.success).toBe(false);
    expect(execution.warnings[0]).toContain("native_guard_blocked");
  });
});
