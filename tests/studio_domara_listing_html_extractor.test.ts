import { describe, expect, it } from "vitest";
import { extractListingFromHtml } from "@/lib/studio/domara/listing-html-extractor";

describe("Domara listing HTML extractor", () => {
  it("parses JSON-LD title/description/price/images", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Residence",
            "name": "Lakeview Villa",
            "description": "Beautiful listing",
            "image": ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
            "offers": { "price": "450000" },
            "floorSize": { "value": 210 }
          }
        </script>
      </head><body></body></html>
    `;

    const extracted = extractListingFromHtml(html, "https://example.com/listing/1");
    expect(extracted.title).toBe("Lakeview Villa");
    expect(extracted.description).toBe("Beautiful listing");
    expect(extracted.price).toBe("450000");
    expect(extracted.squareMeters).toBe(210);
    expect(extracted.imageUrls).toEqual([
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ]);
    expect(extracted.extractionSources).toContain("jsonLd");
  });

  it("parses Open Graph title/description/image/url", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="OG Listing Title" />
        <meta property="og:description" content="OG Listing Description" />
        <meta property="og:image" content="/images/hero.jpg" />
        <meta property="og:url" content="/listing/og-1" />
      </head></html>
    `;

    const extracted = extractListingFromHtml(html, "https://example.com/base");
    expect(extracted.title).toBe("OG Listing Title");
    expect(extracted.description).toBe("OG Listing Description");
    expect(extracted.imageUrls[0]).toBe("https://example.com/images/hero.jpg");
    expect(extracted.canonicalUrl).toBe("https://example.com/listing/og-1");
    expect(extracted.extractionSources).toContain("openGraph");
  });

  it("chooses high-res srcset candidate and resolves relative image URLs", () => {
    const html = `
      <img srcset="/img-small.jpg 320w, /img-large.jpg 1280w" src="/img-fallback.jpg" />
    `;

    const extracted = extractListingFromHtml(html, "https://example.com/listing/42");
    expect(extracted.imageUrls).toContain("https://example.com/img-large.jpg");
    expect(extracted.extractionSources).toContain("visibleImages");
  });

  it("filters icon/logo/pixel images from visible image extraction", () => {
    const html = `
      <img src="/assets/logo.png" alt="Company Logo" />
      <img src="/assets/icon.svg" class="icon" />
      <img src="/assets/tracking-pixel.gif" width="1" height="1" />
      <img src="https://cdn.example.com/gallery-1.jpg" width="1200" height="800" />
    `;

    const extracted = extractListingFromHtml(html, "https://example.com/listing/99");
    expect(extracted.imageUrls).toEqual(["https://cdn.example.com/gallery-1.jpg"]);
  });
});
