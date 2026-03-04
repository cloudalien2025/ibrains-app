import { describe, expect, it } from "vitest";
import {
  buildByoSavePayload,
  isByoProvider,
  toByoStatusMap,
  type ByoKeyRecord,
} from "../lib/ecomviper/byoKeys";

describe("BYO key persistence model", () => {
  it("builds masked metadata from saved keys and restores connected state on reload", () => {
    const payload = buildByoSavePayload({
      provider: "openai",
      apiKey: "sk-live-1234567890ABCD",
      label: "Primary key",
    });

    const rows: ByoKeyRecord[] = [
      {
        provider: payload.provider,
        label: payload.label,
        key_last4: payload.keyLast4,
        key_length: payload.keyLength,
        updated_at: "2026-02-28T00:00:00.000Z",
      },
    ];

    const states = toByoStatusMap(rows);
    expect(states.openai.connected).toBe(true);
    expect(states.openai.masked_key.endsWith("ABCD")).toBe(true);
    expect(states.openai.masked_key.includes("sk-live-1234567890ABCD")).toBe(false);
    expect(states.ga4.connected).toBe(false);
    expect(states.serpapi.connected).toBe(false);
  });

  it("accepts only supported providers", () => {
    expect(isByoProvider("openai")).toBe(true);
    expect(isByoProvider("serpapi")).toBe(true);
    expect(isByoProvider("unsupported-provider")).toBe(false);
  });
});
