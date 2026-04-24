import { describe, expect, it } from "vitest";
import { getDomaraIntegrationStatuses } from "@/lib/studio/domara/integrations";
import { buildOperatorIntegrationRows } from "@/lib/studio/domara/integrations-ui";

describe("Domara OpenAI integration status", () => {
  it("includes OpenAI in integration statuses and marks missing by default", () => {
    const statuses = getDomaraIntegrationStatuses({});
    const openai = statuses.find((status) => status.providerId === "openai");

    expect(openai).toBeDefined();
    expect(openai?.displayName).toBe("OpenAI");
    expect(openai?.configured).toBe(false);
    expect(openai?.validationStatus).toBe("missing");
  });

  it("marks OpenAI configured when OPENAI_API_KEY is set", () => {
    const statuses = getDomaraIntegrationStatuses({ OPENAI_API_KEY: "set" });
    const openai = statuses.find((status) => status.providerId === "openai");

    expect(openai?.configured).toBe(true);
    expect(openai?.validationStatus).toBe("configured");
  });

  it("never leaks raw OpenAI key values", () => {
    const statuses = getDomaraIntegrationStatuses({ OPENAI_API_KEY: "super-secret-openai-key" });
    const serialized = JSON.stringify(statuses);

    expect(serialized.includes("super-secret-openai-key")).toBe(false);
  });

  it("shows OpenAI in operator rows without exposing env var names in default labels", () => {
    const rows = buildOperatorIntegrationRows(getDomaraIntegrationStatuses({ OPENAI_API_KEY: "set" }));
    const openai = rows.find((row) => row.providerId === "openai");

    expect(openai).toBeDefined();
    expect(openai?.displayName).toBe("OpenAI");
    expect(openai?.status).toBe("connected");
    expect(openai?.displayName.includes("API_KEY")).toBe(false);
  });
});
