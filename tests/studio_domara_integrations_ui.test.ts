import { describe, expect, it } from "vitest";
import {
  buildOperatorIntegrationRows,
  maskIntegrationKey,
  resolveOperatorIntegrationStatus,
} from "@/lib/studio/domara/integrations-ui";

describe("Domara integrations UI helpers", () => {
  it("maps configured provider to connected status", () => {
    const rows = buildOperatorIntegrationRows([
      {
        providerId: "openai",
        displayName: "OpenAI",
        category: "ai_generation",
        requiredEnvVars: ["OPENAI_API_KEY"],
        configured: true,
        validationStatus: "configured",
        safeSetupHelp: "x",
        capabilitiesEnabled: [],
      },
      {
        providerId: "elevenlabs",
        displayName: "ElevenLabs",
        category: "voice",
        requiredEnvVars: ["ELEVENLABS_API_KEY"],
        configured: true,
        validationStatus: "configured",
        safeSetupHelp: "x",
        capabilitiesEnabled: [],
      },
    ]);

    const openai = rows.find((row) => row.providerId === "openai");
    expect(openai?.status).toBe("connected");
    expect(openai?.maskedKey).toBe("••••••••");
  });

  it("maps missing provider to missing status", () => {
    const rows = buildOperatorIntegrationRows([]);
    const mapbox = rows.find((row) => row.providerId === "mapbox");

    expect(mapbox?.status).toBe("missing");
    expect(mapbox?.maskedKey).toBeUndefined();
  });

  it("maps invalid validation status to invalid operator status", () => {
    expect(resolveOperatorIntegrationStatus(false, "invalid")).toBe("invalid");
  });

  it("masks key safely and never returns raw key", () => {
    const raw = "super-secret-live-key";
    const masked = maskIntegrationKey(raw);

    expect(masked).toContain("••••••••");
    expect(masked.endsWith(raw.slice(-4))).toBe(true);
    expect(masked.includes(raw)).toBe(false);
  });

  it("exposes no env var names in default row display names", () => {
    const rows = buildOperatorIntegrationRows([]);
    const text = rows.map((row) => row.displayName).join(" ");

    expect(text.includes("API_KEY")).toBe(false);
    expect(rows.length).toBe(7);
  });
});
