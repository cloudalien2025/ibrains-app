import { describe, expect, it } from "vitest";
import { orderProductImages } from "@/lib/ecomviper/shopify/product-image-ordering";

describe("ecomviper product image ordering", () => {
  it("prioritizes front, facts, side, 3-pack, 6-pack, then lifestyle", () => {
    const ordered = orderProductImages([
      { url: "https://example.com/3-pack.png", altText: "3-pack bottle" },
      { url: "https://example.com/lifestyle.png", altText: "lifestyle shot" },
      { url: "https://example.com/side.png", altText: "side directions panel" },
      { url: "https://example.com/front.png", altText: "front product image" },
      { url: "https://example.com/facts.png", altText: "supplement facts" },
      { url: "https://example.com/6-pack.png", altText: "6-pack bundle" },
    ]);

    expect(ordered.map((image) => image.url)).toEqual([
      "https://example.com/front.png",
      "https://example.com/facts.png",
      "https://example.com/side.png",
      "https://example.com/3-pack.png",
      "https://example.com/6-pack.png",
      "https://example.com/lifestyle.png",
    ]);
  });

  it("dedupes and skips null or empty URLs", () => {
    const ordered = orderProductImages([
      { url: "" },
      { url: null },
      { url: "https://example.com/front.png", altText: "front" },
      { url: "https://example.com/front.png", altText: "duplicate" },
    ]);

    expect(ordered).toHaveLength(1);
    expect(ordered[0]?.url).toBe("https://example.com/front.png");
  });
});
