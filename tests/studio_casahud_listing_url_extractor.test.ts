import { describe, expect, it, vi } from "vitest";
import {
  classifyListingImportUrl,
  extractListingUrlMetadata,
  extractListingUrlMetadataFromHtml,
} from "@/lib/studio/domara/listing-url-extractor";

const immobiliareUrl = "https://www.immobiliare.it/annunci/122960988/";
const immobiliareEnglishUrl = "https://www.immobiliare.it/en/annunci/121869400/";

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

const immobiliareEnglishFixtureHtml = `
  <html>
    <head>
      <title>Single family villa via San Berardino, Albanella - immobiliare.it</title>
      <link rel="canonical" href="${immobiliareEnglishUrl}" />
      <meta property="og:title" content="Single family villa via San Berardino, Albanella" />
      <meta property="og:description" content="€299.000 single family villa in Albanella, Salerno, Campania with 3 bedrooms, 2 bathrooms, 150 m² interior, 1,106 m² garden, and private parking." />
      <meta property="og:image" content="/images/albanella-villa-og.jpg" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "House",
          "name": "Single family villa via San Berardino, Albanella",
          "description": "Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.",
          "url": "${immobiliareEnglishUrl}",
          "image": ["//images.example.com/albanella-villa-1.jpg"],
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Via San Berardino",
            "addressLocality": "Albanella",
            "addressRegion": "Campania",
            "addressCountry": "Italy"
          },
          "offers": {
            "@type": "Offer",
            "price": 299000,
            "priceCurrency": "EUR"
          },
          "numberOfBedrooms": 3,
          "numberOfBathroomsTotal": 2,
          "numberOfRooms": 5,
          "floorSize": {
            "@type": "QuantitativeValue",
            "value": 150,
            "unitCode": "MTK"
          }
        }
      </script>
      <script type="application/json" id="__NEXT_DATA__">
        {
          "props": {
            "pageProps": {
              "listing": {
                "propertyType": "Single family villa",
                "commercialSurfaceSqm": 260.6,
                "landSizeSqm": 1106,
                "garageParking": "2 garage/box spaces · 3 parking spaces",
                "balcony": true,
                "terrace": true,
                "condition": "Excellent / renovated",
                "heating": "Independent radiators powered by LPG",
                "airConditioning": "Independent hot/cold",
                "energyClass": "D",
                "photoCount": 86,
                "floorPlanCount": 1,
                "virtualTour": true,
                "updatedDate": "October 16, 2025",
                "advertiser": "Mirko Franco / Professionecasa Capaccio Paestum",
                "city": "Albanella",
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
      <h1>Single family villa via San Berardino, Albanella</h1>
      <section>
        <div>Price</div>
        <div>€299.000</div>
        <div>Address</div>
        <div>Via San Berardino, Albanella, Salerno, Campania, Italy</div>
        <div>Property type</div>
        <div>Single family villa</div>
        <div>Rooms</div>
        <div>5+</div>
        <div>Bedrooms</div>
        <div>3</div>
        <div>Bathrooms</div>
        <div>2</div>
        <div>Interior size</div>
        <div>150 m²</div>
        <div>Commercial surface</div>
        <div>260.6 m²</div>
        <div>Garden</div>
        <div>1.106 m²</div>
        <div>Garage / Parking</div>
        <div>2 garage/box spaces · 3 parking spaces</div>
        <div>Balcony</div>
        <div>Yes</div>
        <div>Terrace</div>
        <div>Yes</div>
        <div>Condition</div>
        <div>Excellent / renovated</div>
        <div>Heating</div>
        <div>Independent radiators powered by LPG</div>
        <div>Air conditioning</div>
        <div>Independent hot/cold</div>
        <div>Energy class</div>
        <div>D</div>
        <div>86 photos</div>
        <div>1 floor plan</div>
        <div>Virtual tour</div>
        <div>Yes</div>
        <div>Updated on</div>
        <div>October 16, 2025</div>
        <div>Advertiser</div>
        <div>Mirko Franco / Professionecasa Capaccio Paestum</div>
      </section>
      <section>
        <h2>Description</h2>
        <p>
          Renovated independent villa with private garden, pool potential, nearby services, and about 25 minutes from the Paestum coast.
        </p>
      </section>
    </body>
  </html>
`;

describe("CasaFlix listing URL extractor", () => {
  it("accepts localized Immobiliare and Idealista URLs through domain-based classification", () => {
    expect(classifyListingImportUrl("https://www.immobiliare.it/annunci/121869400/").classification).toBe("listing");
    expect(classifyListingImportUrl("https://www.immobiliare.it/en/annunci/121869400/").classification).toBe("listing");
    expect(classifyListingImportUrl("https://www.idealista.it/immobile/123456/").classification).toBe("listing");
    expect(classifyListingImportUrl("https://www.idealista.it/en/immobile/123456/").classification).toBe("listing");
    expect(classifyListingImportUrl("https://www.immobiliare.it/vendita-case/campania/").classification).toBe("search_results");
  });

  it("extracts deep listing facts from Immobiliare-like public HTML", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: immobiliareUrl,
      html: immobiliareFixtureHtml,
    });

    expect(result.provider).toBe("immobiliare");
    expect(result.urlClassification).toBe("listing");
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

  it("extracts English Immobiliare fixture data from localized /en/annunci paths", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: immobiliareEnglishUrl,
      html: immobiliareEnglishFixtureHtml,
    });

    expect(result.provider).toBe("immobiliare");
    expect(result.urlClassification).toBe("listing");
    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.title).toBe("Single family villa via San Berardino, Albanella");
    expect(result.data.price).toBe(299000);
    expect(result.data.locationText).toContain("Albanella");
    expect(result.data.propertyType).toBe("Single family villa");
    expect(result.data.bedrooms).toBe(3);
    expect(result.data.bathrooms).toBe(2);
    expect(result.data.interiorSizeSqm).toBe(150);
    expect(result.data.landSizeSqm).toBe(1106);
    expect(result.data.garageParking).toContain("3 parking spaces");
    expect(result.data.energyClass).toBe("D");
    expect(result.data.photoCount).toBe(86);
    expect(result.data.featuredImageUrl).toBe("https://images.example.com/albanella-villa-1.jpg");
    expect(result.data.virtualTour).toBe(true);
    expect(result.data.advertiser).toContain("Professionecasa");
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
    expect(result.urlClassification).toBe("blocked_or_unavailable");
    expect(result.warnings.join(" ")).toContain("limited by the source host");
    expect(result.data.title).toBeUndefined();
  });

  it("returns partial extraction when only limited metadata is publicly readable", () => {
    const result = extractListingUrlMetadataFromHtml({
      url: "https://www.idealista.it/en/immobile/456",
      html: `
        <html>
          <head>
            <meta property="og:title" content="Apartment in Lecce" />
            <meta property="og:description" content="Apartment in Lecce, Puglia, Italy with 2 bedrooms." />
          </head>
        </html>
      `,
    });

    expect(result.extractionStatus).toBe("partial");
    expect(result.needsReviewFields).toContain("price");
    expect(result.needsReviewFields).toContain("images");
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
