import { describe, expect, it } from "vitest";
import { getDefaultProductImageIndex } from "@/lib/ecomviper/shopify/product-image-selection";

describe("ecomviper product image default selection", () => {
  it("selects explicit front role first", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { url: "https://example.com/facts.png", role: "supplement facts", position: 0 },
        { url: "https://example.com/front.png", role: "front", position: 1 },
      ],
    });
    expect(index).toBe(1);
  });

  it("selects primary role when front is absent", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { url: "https://example.com/back.png", role: "back", position: 0 },
        { url: "https://example.com/main.png", role: "primary", position: 4 },
      ],
    });
    expect(index).toBe(1);
  });

  it("selects Shopify featured image by url", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { id: "img-1", url: "https://example.com/first.png", position: 0 },
        { id: "img-2", url: "https://example.com/front.png?size=1200", position: 1 },
      ],
      featuredImageUrl: "https://example.com/front.png",
    });
    expect(index).toBe(1);
  });

  it("uses lowest position when no role or featured signal exists", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { url: "https://example.com/c.png", position: 3 },
        { url: "https://example.com/a.png", position: 1 },
        { url: "https://example.com/b.png", position: 2 },
      ],
    });
    expect(index).toBe(1);
  });

  it("uses front heuristic over supplement facts/back cues", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { url: "https://example.com/supplement-facts.png", altText: "Supplement Facts label", position: 0 },
        { url: "https://example.com/front-bottle.png", altText: "Front bottle", position: 1 },
      ],
    });
    expect(index).toBe(1);
  });

  it("does not select supplement facts first when a front image exists", () => {
    const index = getDefaultProductImageIndex({
      images: [
        { url: "https://example.com/a.png", title: "Supplement Facts", position: 0 },
        { url: "https://example.com/b.png", title: "Main bottle front", position: 5 },
      ],
    });
    expect(index).toBe(1);
  });

  it("falls back to first available image when no signal exists", () => {
    const index = getDefaultProductImageIndex({
      images: [{ url: "https://example.com/one.png" }, { url: "https://example.com/two.png" }],
    });
    expect(index).toBe(0);
  });
});
