import { describe, expect, it } from "vitest";
import { buildDomaraLocationRequest } from "@/lib/studio/domara/location-intelligence";
import { normalizePropertyListingInput } from "@/lib/studio/domara/listing-normalizer";
import { createLocationProvider } from "@/lib/studio/domara/location-provider";
import { generatePropertyVideoPlan } from "@/lib/studio/domara/property-video-plan";

describe("Domara location intelligence", () => {
  it("builds location request from listing fields", () => {
    const request = buildDomaraLocationRequest({
      country: "Italy",
      city: "Florence",
      region: "Tuscany",
      neighborhood: "Oltrarno",
      title: "Oltrarno Apartment",
      imageUrls: [],
    });

    expect(request.locationLabel).toBe("Oltrarno, Florence, Tuscany, Italy");
    expect(request.country).toBe("Italy");
    expect(request.city).toBe("Florence");
    expect(request.region).toBe("Tuscany");
    expect(request.neighborhood).toBe("Oltrarno");
  });

  it("respects provided coordinates during enrichment", async () => {
    const listing = normalizePropertyListingInput({
      country: "Italy",
      city: "Florence",
      region: "Tuscany",
      title: "Coordinate Listing",
      imageUrls: [],
      latitude: "43.76956",
      longitude: "11.25581",
    });

    const provider = createLocationProvider({});
    const enrichment = await provider.enrich(listing);

    expect(enrichment.coordinates?.latitude).toBe(43.76956);
    expect(enrichment.coordinates?.longitude).toBe(11.25581);
    expect(enrichment.coordinates?.confidence).toBe("provided");
    expect(enrichment.summary).toContain("Coordinates received");
  });

  it("falls back to mock provider when Google credentials are missing", async () => {
    const listing = normalizePropertyListingInput({
      country: "Italy",
      city: "Rome",
      title: "Fallback Listing",
      imageUrls: [],
    });

    const provider = createLocationProvider({ GOOGLE_MAPS_API_KEY: "", GOOGLE_PLACES_API_KEY: "" });
    const enrichment = await provider.enrich(listing);

    expect(provider.providerName).toBe("mock");
    expect(enrichment.provider).toBe("mock");
    expect(enrichment.status).toBe("placeholder");
  });

  it("maps POI categories into lifestyle narration scenes", async () => {
    const plan = await generatePropertyVideoPlan({
      country: "Italy",
      city: "Milan",
      title: "POI Mapping Listing",
      imageUrls: ["https://example.com/1.jpg"],
    });

    const lifestyleScene = plan.scenes.find((scene) => scene.title === "Lifestyle & Convenience");
    expect(lifestyleScene).toBeDefined();
    expect(lifestyleScene?.narration).toContain("POI focus");
    expect(plan.locationIntelligence?.pointsOfInterest.length).toBeGreaterThan(0);
  });

  it("does not emit exact distance or travel-time labels in placeholder mode", async () => {
    const listing = normalizePropertyListingInput({
      country: "Italy",
      city: "Naples",
      title: "No Claims Listing",
      imageUrls: [],
    });

    const provider = createLocationProvider({});
    const enrichment = await provider.enrich(listing);

    for (const poi of enrichment.pointsOfInterest) {
      expect(poi.distanceLabel).toBeUndefined();
      expect(poi.travelTimeLabel).toBeUndefined();
    }
  });

  it("includes location scenes and placeholder messaging in the generated plan", async () => {
    const plan = await generatePropertyVideoPlan({
      country: "Italy",
      city: "Turin",
      title: "Location Scene Listing",
      imageUrls: [],
    });

    expect(plan.scenes.some((scene) => scene.title === "Location Context")).toBe(true);
    expect(plan.scenes.some((scene) => scene.title === "Lifestyle & Convenience")).toBe(true);
    expect(plan.enrichmentSummary).toContain("Location enrichment placeholder");
    expect(plan.locationIntelligence?.placeholderMessage).toContain("Google Maps / Places integration pending");
  });
});
