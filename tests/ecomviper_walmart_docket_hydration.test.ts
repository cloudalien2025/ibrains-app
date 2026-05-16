import { describe, expect, it } from "vitest";
import {
  hydrateWalmartDocketFromSources,
  normalizeWalmartBulletList,
  normalizeWalmartImageList,
  pickFirstNonPlaceholder,
  collectWalmartDocketCandidateValues,
  normalizeWalmartTextValue,
} from "@/lib/ecomviper/walmart/walmart-docket-hydration";
import {
  WALMART_DOCKET_BULLET_ALIASES,
  WALMART_DOCKET_IMAGE_ALIASES,
  WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
  WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
} from "@/lib/ecomviper/walmart/walmart-docket-aliases";

describe("Walmart docket hydration aliases and parsing", () => {
  it("hydrates short/long descriptions and bullets from raw.content aliases", () => {
    const docket = hydrateWalmartDocketFromSources({
      sku: "ROC948",
      hydratedAt: "2026-05-16T00:00:00.000Z",
      statuses: ["imported_docket_ready", "detail_hydrated"],
      sources: [
        {
          source: "items_list",
          payload: {
            sku: "ROC948",
            productName: "List Title",
            shortDescription: "n/a",
            fullDescription: "not available",
          },
          retrievedAt: "2026-05-16T00:00:00.000Z",
          confidence: "medium",
        },
        {
          source: "item_detail",
          payload: {
            raw: {
              content: {
                siteDescription: "Supports joint comfort and daily mobility.",
                fullDescription: "Detailed product profile with complete supplement facts.",
                keyFeatures: ["Clinically studied ingredient", "No artificial dyes"],
              },
            },
          },
          retrievedAt: "2026-05-16T00:05:00.000Z",
          confidence: "high",
        },
      ],
    });

    expect(docket.content.shortDescription.value).toBe("Supports joint comfort and daily mobility.");
    expect(docket.content.longDescription.value).toBe(
      "Detailed product profile with complete supplement facts."
    );
    expect(docket.content.bullets.value).toEqual([
      "Clinically studied ingredient",
      "No artificial dyes",
    ]);
    expect(docket.content.shortDescription.source).toBe("item_detail");
    expect(docket.content.shortDescription.retrievedAt).toBe("2026-05-16T00:05:00.000Z");
    expect(docket.statuses).toContain("detail_hydrated");
  });

  it("hydrates bullet aliases from highlights/aboutThisItem and parses html safely", () => {
    const docket = hydrateWalmartDocketFromSources({
      sku: "ROC949",
      sources: [
        {
          source: "item_detail",
          payload: {
            highlights: "<ul><li>High potency</li><li>Gluten free</li></ul>",
            aboutThisItem: "Third-party tested|GMP facility",
          },
          retrievedAt: "2026-05-16T00:00:00.000Z",
        },
      ],
    });

    expect(docket.content.bullets.value).toEqual(["High potency", "Gluten free"]);
    expect(normalizeWalmartBulletList("Line one\nLine two;Line three|Line four")).toEqual([
      "Line one",
      "Line two",
      "Line three",
      "Line four",
    ]);
  });

  it("hydrates primary and gallery images from broad image aliases", () => {
    const docket = hydrateWalmartDocketFromSources({
      sku: "ROC950",
      sources: [
        {
          source: "items_list",
          payload: {
            mainImage: "https://images.example.com/primary.jpg",
            additionalImages: [
              "https://images.example.com/one.jpg",
              { url: "https://images.example.com/two.jpg" },
            ],
          },
          retrievedAt: "2026-05-16T00:00:00.000Z",
        },
      ],
    });

    expect(docket.media.primaryImage.value).toBe("https://images.example.com/primary.jpg");
    expect(docket.media.galleryImages.value).toEqual([
      "https://images.example.com/primary.jpg",
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.jpg",
    ]);
    expect(normalizeWalmartImageList({ images: ["https://images.example.com/a.jpg"] })).toEqual([
      "https://images.example.com/a.jpg",
    ]);
  });

  it("keeps fallback behavior when leading values are placeholders", () => {
    const candidates = collectWalmartDocketCandidateValues({
      aliases: WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES,
      normalizer: normalizeWalmartTextValue,
      sources: [
        {
          source: "items_list",
          payload: { shortDescription: "unknown" },
        },
        {
          source: "item_detail",
          payload: { shelfDescription: "Real short description from detail." },
        },
      ],
    });

    const winner = pickFirstNonPlaceholder(candidates);
    expect(winner?.value).toBe("Real short description from detail.");
    expect(winner?.metadata.source).toBe("item_detail");
  });

  it("collects long and bullet aliases from nested raw payload paths", () => {
    const longCandidates = collectWalmartDocketCandidateValues({
      aliases: WALMART_DOCKET_LONG_DESCRIPTION_ALIASES,
      normalizer: normalizeWalmartTextValue,
      sources: [
        {
          source: "item_detail",
          payload: {
            raw: {
              product: {
                longDescription: "Raw product long description.",
              },
            },
          },
        },
      ],
    });
    const bulletCandidates = collectWalmartDocketCandidateValues({
      aliases: WALMART_DOCKET_BULLET_ALIASES,
      normalizer: normalizeWalmartBulletList,
      sources: [
        {
          source: "item_detail",
          payload: {
            raw: {
              content: {
                aboutThisItem: "Feature A;Feature B",
              },
            },
          },
        },
      ],
    });
    const imageCandidates = collectWalmartDocketCandidateValues({
      aliases: WALMART_DOCKET_IMAGE_ALIASES,
      normalizer: normalizeWalmartImageList,
      sources: [
        {
          source: "item_report",
          payload: {
            galleryImageUrls: "https://images.example.com/r1.jpg|https://images.example.com/r2.jpg",
          },
        },
      ],
    });

    expect(pickFirstNonPlaceholder(longCandidates)?.value).toBe("Raw product long description.");
    expect(pickFirstNonPlaceholder(bulletCandidates)?.value).toEqual(["Feature A", "Feature B"]);
    expect(pickFirstNonPlaceholder(imageCandidates)?.value).toEqual([
      "https://images.example.com/r1.jpg",
      "https://images.example.com/r2.jpg",
    ]);
  });
});
