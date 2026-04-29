import { describe, expect, it, vi } from "vitest";
import {
  extractListingUrlMetadata,
  extractListingUrlMetadataFromHtml,
} from "@/lib/studio/domara/listing-url-extractor";

const immobiliareUrl = "https://www.immobiliare.it/annunci/122960988/";

const immobiliareFixtureHtml = `
  <html>
    <head>
      <title>Casale Contrada Campelle 2, Altavilla Silentina - immobiliare.it</title>
      <link rel="canonical" href="${immobiliareUrl}" />
      <meta property="og:title" content="Casale Contrada Campelle 2, Altavilla Silentina" />
      <meta property="og:description" content="€198.000 country house in Altavilla Silentina with 4 bedrooms, 2 bathrooms, 300 m² and 12,900 m² land." />
      <meta property="og:image" content="//images.example.com/og-country-house.jpg" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Residence",
          "name": "Altavilla Silentina Country House with Olive Grove",
          "description": "Independent country house with olive grove in panoramic Cilento countryside position, around 30 minutes from the beaches.",
          "url": "${immobiliareUrl}",
          "image": ["/media/country-house-hero.jpg"],
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Contrada Campelle 2",
            "addressLocality": "Altavilla Silentina",
            "addressRegion": "Campania",
            "addressCountry": "Italy"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": 40.5342,
            "longitude": 15.1164
          },
          "offers": {
            "@type": "Offer",
            "price": 198000,
            "priceCurrency": "EUR"
          },
          "numberOfBedrooms": 4,
          "numberOfBathroomsTotal": 2,
          "numberOfRooms": 5,
          "floorSize": {
            "@type": "QuantitativeValue",
            "value": 300,
            "unitCode": "MTK"
          }
        }
      </script>
      <script type="application/json" id="__NEXT_DATA__">
        {
          "props": {
            "pageProps": {
              "listing": {
                "propertyType": "Casale / Country House / Rustic Farmhouse",
                "landSizeSqm": 12900,
                "floorCount": 3,
                "floorText": "ground floor, 1st floor, 2nd floor / 3 floors total",
                "garageParking": "1 garage box · 5 parking spaces",
                "balcony": true,
                "terrace": true,
                "furnished": "Partially furnished",
                "condition": "Good condition",
                "heating": "Autonomous",
                "energyClass": "F, 192 kWh/m²/year",
                "pricePerSquareMeter": 122,
                "referenceCode": "EK-122960988",
                "updatedDate": "March 11, 2026",
                "photoCount": 16,
                "floorPlanCount": 3,
                "city": "Altavilla Silentina",
                "province": "Salerno",
                "region": "Campania",
                "country": "Italy"
              }
            }
          }
        }
      </script>
    </head>
    <body>
      <h1>Altavilla Silentina Country House with Olive Grove</h1>
      <section>
        <div>Prezzo</div>
        <div>€198.000</div>
        <div>Indirizzo</div>
        <div>Contrada Campelle 2, Altavilla Silentina, Salerno, Campania, Italy</div>
        <div>Tipologia</div>
        <div>Casale / Country House / Rustic Farmhouse</div>
        <div>Locali</div>
        <div>5+</div>
        <div>Camere da letto</div>
        <div>4</div>
        <div>Bagni</div>
        <div>2</div>
        <div>Superficie interna</div>
        <div>300 m²</div>
        <div>Terreno</div>
        <div>12.900 m²</div>
        <div>Piano</div>
        <div>ground floor, 1st floor, 2nd floor / 3 floors total</div>
        <div>Garage / Parking</div>
        <div>1 garage box · 5 parking spaces</div>
        <div>Balcone</div>
        <div>Sì</div>
        <div>Terrazzo</div>
        <div>Sì</div>
        <div>Stato</div>
        <div>Good condition</div>
        <div>Arredato</div>
        <div>Partially furnished</div>
        <div>Riscaldamento</div>
        <div>Autonomous</div>
        <div>Classe energetica</div>
        <div>F, 192 kWh/m²/year</div>
        <div>Rif.</div>
        <div>EK-122960988</div>
        <div>Aggiornato il</div>
        <div>March 11, 2026</div>
        <div>16 foto</div>
        <div>3 planimetrie</div>
      </section>
      <section>
        <h2>Descrizione</h2>
        <p>
          Independent country house with olive grove, over 12,900 m² of land, and a panoramic position around 250 meters above sea level.
          On clear days the view reaches Capri, while productive olive trees, fruit trees, and a private natural spring make the property suited
          for a private residence, vacation home, or agriturismo.
        </p>
      </section>
    </body>
  </html>
`;

describe("CasaHUD listing URL extractor", () => {
  it("extracts deep listing facts from Immobiliare-like public HTML", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: immobiliareUrl,
      html: immobiliareFixtureHtml,
    });

    expect(result.provider).toBe("immobiliare");
    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.title).toBe("Altavilla Silentina Country House with Olive Grove");
    expect(result.data.locationText).toBe("Contrada Campelle 2, Altavilla Silentina, Salerno, Campania, Italy");
    expect(result.data.price).toBe(198000);
    expect(result.data.priceText).toBe("€198,000");
    expect(result.data.propertyType).toContain("Country House");
    expect(result.data.bedrooms).toBe(4);
    expect(result.data.bathrooms).toBe(2);
    expect(result.data.rooms).toBe(5);
    expect(result.data.interiorSizeSqm).toBe(300);
    expect(result.data.landSizeSqm).toBe(12900);
    expect(result.data.referenceCode).toBe("EK-122960988");
    expect(result.data.photoCount).toBe(16);
    expect(result.data.floorPlanCount).toBe(3);
    expect(result.data.featuredImageUrl).toBe("https://www.immobiliare.it/media/country-house-hero.jpg");
    expect(result.data.description).toContain("olive grove");
    expect(result.data.casaHudShortSummary).toContain("12,900 m² of land");
    expect(result.data.casaHudNarrationSeed).toContain("olive grove");
    expect(result.needsReviewFields).not.toContain("price");
    expect(result.needsReviewFields).not.toContain("location");
    expect(result.needsReviewFields).not.toContain("images");
  });

  it("falls back to Open Graph and title text when structured data is missing", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: "https://www.idealista.it/en/annuncio/123",
      html: `
        <html>
          <head>
            <title>Apartment in Tropea - idealista.it</title>
            <meta property="og:title" content="Apartment in Tropea" />
            <meta
              property="og:description"
              content="EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm."
            />
            <meta property="og:image" content="https://images.example.com/tropea-og.jpg" />
          </head>
        </html>
      `,
    });

    expect(result.provider).toBe("idealista");
    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.title).toBe("Apartment in Tropea");
    expect(result.data.price).toBe(284000);
    expect(result.data.locationText).toBe("Tropea, Calabria, Italy");
    expect(result.data.bedrooms).toBe(2);
    expect(result.data.bathrooms).toBe(2);
    expect(result.data.interiorSizeSqm).toBe(88);
    expect(result.data.featuredImageUrl).toBe("https://images.example.com/tropea-og.jpg");
  });

  it("rejects unsafe protocols", async () => {
    await expect(extractListingUrlMetadata({ url: "javascript:alert(1)" })).rejects.toThrow(
      "Only http/https listing URLs are supported.",
    );
  });

  it("returns blocked_or_unavailable with warnings when the source host blocks safe access", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      url: immobiliareUrl,
      text: async () => "<html><body>Please enable JS and disable any ad blocker</body></html>",
    }));

    const result = await extractListingUrlMetadata({
      url: immobiliareUrl,
      fetchImpl,
    });

    expect(result.extractionStatus).toBe("blocked_or_unavailable");
    expect(result.warnings.join(" ")).toContain("limited by the source host");
    expect(result.data.title).toBeUndefined();
  });

  it("resolves relative and protocol-relative image URLs safely", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: "https://example.com/listing/1",
      html: `
        <html>
          <head>
            <meta property="og:title" content="Example listing" />
            <meta property="og:image" content="//cdn.example.com/example-og.jpg" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "House",
                "name": "Example listing",
                "image": ["/images/example-relative.jpg"]
              }
            </script>
          </head>
        </html>
      `,
    });

    expect(result.data.featuredImageUrl).toBe("https://example.com/images/example-relative.jpg");
    expect(result.data.imageUrls).toEqual([
      "https://example.com/images/example-relative.jpg",
      "https://cdn.example.com/example-og.jpg",
    ]);
  });
});
