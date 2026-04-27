import { describe, expect, it } from "vitest";
import {
  buildCasaHudConnectionCards,
  buildOperatorIntegrationRows,
  getCasaHudSetupMessage,
  getMissingCasaHudCoreConnections,
  maskIntegrationKey,
  resolveOperatorIntegrationStatus,
  shouldOpenCasaHudSetupForGenerate,
} from "@/lib/studio/domara/integrations-ui";
import type { DomaraIntegrationProviderId, DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";

function providerStatus(
  providerId: DomaraIntegrationProviderId,
  configured: boolean,
): DomaraIntegrationProviderStatus {
  return {
    providerId,
    displayName: providerId,
    category:
      providerId === "openai"
        ? "ai_generation"
        : providerId === "elevenlabs"
          ? "voice"
          : providerId === "youtube"
            ? "publishing"
            : providerId === "google_maps_places" || providerId === "mapbox"
              ? "maps"
              : providerId === "cloudinary" || providerId === "digitalocean_spaces"
                ? "media_storage"
                : "listing_ingestion",
    requiredEnvVars: [],
    configured,
    validationStatus: configured ? "configured" : "missing",
    safeSetupHelp: "",
    capabilitiesEnabled: [],
  };
}

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
    expect(rows.length).toBe(9);
  });

  it("builds premium CasaHUD connection cards around required and optional services", () => {
    const cards = buildCasaHudConnectionCards([
      providerStatus("youtube", true),
      providerStatus("openai", true),
      providerStatus("idealista", true),
      providerStatus("immobiliare", true),
      providerStatus("mapbox", true),
      providerStatus("google_maps_places", true),
      providerStatus("cloudinary", true),
      providerStatus("elevenlabs", false),
    ]);

    expect(cards.map((card) => card.title)).toEqual([
      "OpenAI",
      "Listing Sources",
      "Maps & Location Visuals",
      "Local Places & POIs",
      "Media Storage",
      "YouTube Channel",
      "Voice Narration",
    ]);
    expect(cards.filter((card) => card.required).map((card) => card.id)).toEqual([
      "openai",
      "listing_sources",
      "mapbox",
      "google_places",
      "media_storage",
      "youtube",
    ]);
    expect(cards.find((card) => card.id === "elevenlabs")?.optional).toBe(true);
    expect(cards.find((card) => card.id === "elevenlabs")?.statusLabel).toBe("Optional");
  });

  it("opens setup before Generate Viral Video when core connections are missing", () => {
    const cards = buildCasaHudConnectionCards([
      providerStatus("youtube", false),
      providerStatus("openai", true),
      providerStatus("idealista", false),
      providerStatus("immobiliare", false),
      providerStatus("mapbox", false),
      providerStatus("google_maps_places", false),
      providerStatus("cloudinary", false),
    ]);

    expect(shouldOpenCasaHudSetupForGenerate(cards)).toBe(true);
    expect(getMissingCasaHudCoreConnections(cards).map((card) => card.title)).toEqual([
      "Listing Sources",
      "Maps & Location Visuals",
      "Local Places & POIs",
      "Media Storage",
      "YouTube Channel",
    ]);
    expect(getCasaHudSetupMessage(cards)).toContain("before CasaHUD generates a production video");
  });

  it("does not fake connected states for CasaHUD cards", () => {
    const cards = buildCasaHudConnectionCards([
      providerStatus("youtube", true),
      providerStatus("openai", true),
      providerStatus("idealista", true),
      providerStatus("mapbox", true),
      providerStatus("google_maps_places", true),
      providerStatus("cloudinary", true),
    ]);

    expect(shouldOpenCasaHudSetupForGenerate(cards)).toBe(false);
    expect(cards.find((card) => card.id === "elevenlabs")?.status).toBe("optional");
    expect(cards.find((card) => card.id === "elevenlabs")?.ctaLabel).toBe("Connect");
  });

  it("keeps CasaHUD setup card copy user-facing", () => {
    const cards = buildCasaHudConnectionCards([]);
    const cardText = cards
      .flatMap((card) => [
        card.title,
        card.enables,
        card.detail,
        card.missingSetupGuidance,
        card.safeErrorState,
        card.ctaLabel,
        ...(card.supportedSourceLabels || []),
      ])
      .join(" ");
    const message = getCasaHudSetupMessage(cards);
    const forbidden = /API_KEY|env var|DATABASE_URL|DIRECTORYIQ_DATABASE_URL|provider seam|migration|raw credential|raw secret|debug|mock|sample/i;

    expect(`${cardText} ${message}`).not.toMatch(forbidden);
  });

  it("marks one listing source as partially connected without blocking generation", () => {
    const cards = buildCasaHudConnectionCards([
      providerStatus("youtube", true),
      providerStatus("openai", true),
      providerStatus("idealista", true),
      providerStatus("immobiliare", false),
      providerStatus("mapbox", true),
      providerStatus("google_maps_places", true),
      providerStatus("digitalocean_spaces", true),
    ]);

    const listingSources = cards.find((card) => card.id === "listing_sources");
    expect(listingSources?.statusLabel).toBe("Partially Connected");
    expect(getMissingCasaHudCoreConnections(cards).map((card) => card.id)).not.toContain("listing_sources");
    expect(shouldOpenCasaHudSetupForGenerate(cards)).toBe(false);
  });
});
