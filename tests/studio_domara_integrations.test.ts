import { describe, expect, it } from "vitest";
import { getDomaraIntegrationCapabilityMap, getDomaraIntegrationStatuses } from "@/lib/studio/domara/integrations";

describe("Domara integrations registry", () => {
  it("reports missing provider statuses when env vars are absent", () => {
    const statuses = getDomaraIntegrationStatuses({});
    const elevenlabs = statuses.find((status) => status.providerId === "elevenlabs");
    const mapbox = statuses.find((status) => status.providerId === "mapbox");

    expect(elevenlabs?.configured).toBe(false);
    expect(elevenlabs?.validationStatus).toBe("missing");
    expect(mapbox?.configured).toBe(false);
  });

  it("reports configured provider when env var is present", () => {
    const statuses = getDomaraIntegrationStatuses({ ELEVENLABS_API_KEY: "set", OPENAI_API_KEY: "openai-secret" });
    const elevenlabs = statuses.find((status) => status.providerId === "elevenlabs");
    const openai = statuses.find((status) => status.providerId === "openai");

    expect(elevenlabs?.configured).toBe(true);
    expect(elevenlabs?.validationStatus).toBe("configured");
    expect(openai?.configured).toBe(true);
    expect(openai?.validationStatus).toBe("configured");
  });

  it("maps provider capabilities correctly", () => {
    const { capabilities } = getDomaraIntegrationCapabilityMap({
      OPENAI_API_KEY: "oai",
      ELEVENLABS_API_KEY: "x",
      MAPBOX_ACCESS_TOKEN: "y",
      GOOGLE_MAPS_API_KEY: "z",
      CLOUDINARY_URL: "cloudinary",
    });

    expect(capabilities.openaiGeneration).toBe(true);
    expect(capabilities.elevenlabsLiveNarration).toBe(true);
    expect(capabilities.mapboxVisuals).toBe(true);
    expect(capabilities.googleMapsVisuals).toBe(true);
    expect(capabilities.mediaStorage).toBe(true);
    expect(capabilities.youtubePublishingApi).toBe(false);
  });

  it("never leaks secret values or setup internals into provider status payload", () => {
    const env = {
      OPENAI_API_KEY: "super-secret-openai",
      ELEVENLABS_API_KEY: "super-secret-elevenlabs",
      MAPBOX_ACCESS_TOKEN: "super-secret-mapbox",
      GOOGLE_MAPS_API_KEY: "super-secret-google",
    };

    const statusJson = JSON.stringify(getDomaraIntegrationStatuses(env));
    expect(statusJson.includes("super-secret")).toBe(false);
    expect(statusJson.includes("ELEVENLABS_API_KEY")).toBe(false);
    expect(statusJson.includes("OPENAI_API_KEY")).toBe(false);
    expect(statusJson.includes("DATABASE_URL")).toBe(false);
  });
});
