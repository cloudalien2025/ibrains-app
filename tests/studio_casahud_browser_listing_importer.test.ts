import { describe, expect, it } from "vitest";
import {
  CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS,
  parseCasaHudBrowserListingCapture,
} from "@/lib/studio/domara/browser-listing-capture-parser";

const albanellaPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/121869400/?utm_source=share",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/121869400/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-04-30T09:00:00.000Z",
  captureVersion: "2026-04-30",
  title: "Single family villa via San Berardino, Albanella - immobiliare.it",
  metaDescription:
    "€299.000 single family villa in Albanella, Salerno, Campania with 3 bedrooms, 2 bathrooms, 150 m² interior, 1,106 m² garden, and private parking.",
  openGraph: {
    title: "Single family villa via San Berardino, Albanella",
    description:
      "Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.",
    image: "https://images.example.com/albanella-og.jpg",
  },
  twitter: {
    title: "Single family villa via San Berardino, Albanella",
    description:
      "Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.",
    image: "https://images.example.com/albanella-twitter.jpg",
  },
  visibleText: `
    Price
    €299.000
    Address
    Via San Berardino, Albanella, Salerno, Campania, Italy
    Property type
    Single family villa
    Rooms
    5+
    Bedrooms
    3
    Bathrooms
    2
    Interior size
    150 m²
    Commercial surface
    260.6 m²
    Garden
    1.106 m²
    Garage / Parking
    2 garage/box spaces · 3 parking spaces
    Balcony
    Yes
    Terrace
    Yes
    Condition
    Excellent / renovated
    Heating
    Independent radiators powered by LPG
    Air conditioning
    Independent hot/cold
    Energy class
    D
    86 photos
    1 floor plan
    Virtual tour
    Yes
    Updated on
    October 16, 2025
    Advertiser
    Mirko Franco / Professionecasa Capaccio Paestum
    Description
    Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.
  `,
  imageCandidates: [
    {
      url: "https://images.example.com/albanella-og.jpg",
      source: "og",
      width: 1600,
      height: 900,
    },
    {
      url: "javascript:alert(1)",
      source: "visible_img",
      width: 1400,
      height: 900,
    },
    {
      url: "https://images.example.com/albanella-gallery.jpg",
      source: "visible_img",
      width: 1280,
      height: 720,
    },
  ],
};

const capaccioPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-04-30T11:15:00.000Z",
  captureVersion: "2026-04-30",
  title: "via Capaccio-Paestum 13 Capaccio Paestum. Good condition Single family villa with Terrace - immobiliare.it",
  metaDescription: "Don&#39;t miss this opportunity! Capaccio Paestum, panoramic detached villa, just 500 meters from th...",
  openGraph: {
    title: "Single family villa via Capaccio-Paestum 13, Capaccio Paestum",
    description:
      "Don&#39;t miss this opportunity! Capaccio Paestum detached villa close to the coast, with terrace, parking, and spacious family-ready interiors.",
    image: "https://images.example.com/capaccio-og.jpg",
  },
  visibleText: `
    Price
    € 299.000
    Location
    via Capaccio-Paestum 13 Capaccio Paestum. Good condition, parking space, with terrace, independent heating,
    Address
    Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy
    Property type
    Single family villa
    Bedrooms
    4
    Bathrooms
    3
    Rooms
    4+
    Interior size
    200 m²
    Garage / Parking
    , car parking,
    Condition
    Good condition
    Heating
    Independent heating
    Description
    Don&#39;t miss this opportunity! Capaccio Paestum detached villa with panoramic exposure just 500 meters from the town center and close to the coast. Spacious interiors, terrace, and dedicated parking make it ideal for family living year-round.
  `,
  imageCandidates: [
    { url: "https://images.example.com/capaccio-og.jpg", source: "og" as const, width: 1600, height: 900 },
    { url: "https://images.example.com/capaccio-gallery.jpg", source: "visible_img" as const, width: 1280, height: 720 },
  ],
};

describe("CasaHUD browser listing capture parser", () => {
  it("parses an Immobiliare-like browser payload into a browser-assisted listing candidate", () => {
    const parsed = parseCasaHudBrowserListingCapture(albanellaPayload);

    expect(parsed.provider).toBe("immobiliare");
    expect(parsed.extractionStatus).toBe("extracted");
    expect(parsed.candidate.sourceType).toBe("browser_assisted_import");
    expect(parsed.candidate.sourceUrl).toBe("https://www.immobiliare.it/en/annunci/121869400/");
    expect(parsed.candidate.title).toContain("Albanella");
    expect(parsed.candidate.price).toBe(299000);
    expect(parsed.candidate.locationText).toContain("Albanella, Salerno, Campania, Italy");
    expect(parsed.candidate.propertyType).toBe("Single family villa");
    expect(parsed.candidate.bedrooms).toBe(3);
    expect(parsed.candidate.bathrooms).toBe(2);
    expect(parsed.candidate.sizeSqm).toBe(150);
    expect(parsed.candidate.commercialSurfaceSqm).toBe(260.6);
    expect(parsed.candidate.landSizeSqm).toBe(1106);
    expect(parsed.candidate.garageParking).toContain("parking");
    expect(parsed.candidate.energyClass).toBe("D");
    expect(parsed.candidate.photoCount).toBe(86);
    expect(parsed.candidate.floorPlanCount).toBe(1);
    expect(parsed.candidate.virtualTour).toBe(true);
    expect(parsed.candidate.featuredImageUrl).toBe("https://images.example.com/albanella-og.jpg");
    expect(parsed.candidate.imageUrls).not.toContain("javascript:alert(1)");
    expect(parsed.candidate.casaHudNarrationSeed).toContain("€299,000");
    expect(parsed.candidate.casaHudNarrationSeed?.toLowerCase()).not.toContain("provider metadata");
  });

  it("drops unsafe image URLs and trims oversized visible text", () => {
    const parsed = parseCasaHudBrowserListingCapture({
      ...albanellaPayload,
      visibleText: `Price\n€299.000\n${"Garden and coastal access. ".repeat(5000)}`,
      imageCandidates: [
        { url: "data:image/png;base64,abc", source: "visible_img" as const },
        { url: "https://images.example.com/safe.jpg", source: "visible_img" as const, width: 1200, height: 700 },
      ],
    });

    expect(parsed.payload.visibleText?.length).toBeLessThanOrEqual(CASAHUD_BROWSER_IMPORT_MAX_VISIBLE_TEXT_CHARS + 1);
    expect(parsed.candidate.imageUrls).toEqual(["https://images.example.com/albanella-og.jpg", "https://images.example.com/albanella-twitter.jpg", "https://images.example.com/safe.jpg"]);
  });

  it("cleans an Immobiliare-like capaccio payload with decoded description, extracted price, and normalized location", () => {
    const parsed = parseCasaHudBrowserListingCapture(capaccioPayload);

    expect(parsed.provider).toBe("immobiliare");
    expect(parsed.candidate.sourceUrl).toBe("https://www.immobiliare.it/en/annunci/114752041/");
    expect(parsed.candidate.price).toBe(299000);
    expect(parsed.candidate.priceText).toBe("€299,000");
    expect(parsed.candidate.propertyType).toBe("Single family villa");
    expect(parsed.candidate.bedrooms).toBe(4);
    expect(parsed.candidate.bathrooms).toBe(3);
    expect(parsed.candidate.rooms).toBe(4);
    expect(parsed.candidate.sizeSqm).toBe(200);
    expect(parsed.candidate.locationText).toBe("Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy");
    expect(parsed.candidate.locationText?.toLowerCase()).not.toContain("good condition");
    expect(parsed.candidate.locationText?.toLowerCase()).not.toContain("parking");
    expect(parsed.candidate.garageParking).toBe("Car parking");
    expect(parsed.candidate.title).toContain("Capaccio Paestum");
    expect(parsed.candidate.title?.toLowerCase()).not.toContain("good condition");
    expect(parsed.candidate.descriptionSnippet).toContain("Don't miss this opportunity!");
    expect(parsed.candidate.descriptionSnippet).toContain("500 meters from the town center");
    expect(parsed.candidate.descriptionSnippet).not.toContain("Don&#39;t");
    expect(parsed.candidate.descriptionSnippet).not.toContain("th...");
    expect(parsed.candidate.imageUrls).toContain("https://images.example.com/capaccio-og.jpg");
    expect(parsed.candidate.needsReviewFields || []).not.toContain("price");
    expect(parsed.candidate.casaHudNarrationSeed?.toLowerCase()).not.toContain("provider metadata");
  });

  it("extracts price from both leading and trailing currency formats", () => {
    const euroLeading = parseCasaHudBrowserListingCapture({
      ...capaccioPayload,
      visibleText: "Price\n€299,000\nAddress\nVia Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy",
    });
    const euroTrailing = parseCasaHudBrowserListingCapture({
      ...capaccioPayload,
      visibleText: "Prezzo\n299.000 €\nAddress\nVia Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy",
    });

    expect(euroLeading.candidate.price).toBe(299000);
    expect(euroTrailing.candidate.price).toBe(299000);
  });

  it("keeps price as needs review when no price exists in payload", () => {
    const parsed = parseCasaHudBrowserListingCapture({
      ...capaccioPayload,
      metaDescription: "Detached villa in Capaccio Paestum with terrace and parking.",
      openGraph: { ...capaccioPayload.openGraph, description: "Detached villa in Capaccio Paestum with terrace and parking." },
      visibleText: `
        Address
        Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy
        Property type
        Single family villa
        Bedrooms
        4
        Bathrooms
        3
      `,
    });

    expect(parsed.candidate.price).toBeUndefined();
    expect(parsed.candidate.needsReviewFields).toContain("price");
  });

  it("rejects unsafe protocols for the captured source URL", () => {
    expect(() =>
      parseCasaHudBrowserListingCapture({
        ...albanellaPayload,
        sourceUrl: "javascript:alert(1)",
      }),
    ).toThrow(/Only http\/https/i);
  });

  it("rejects payloads that include sensitive browser fields", () => {
    expect(() =>
      parseCasaHudBrowserListingCapture({
        ...albanellaPayload,
        cookies: "session=secret",
      }),
    ).toThrow(/visible page text, metadata, and image candidates/i);
  });
});
