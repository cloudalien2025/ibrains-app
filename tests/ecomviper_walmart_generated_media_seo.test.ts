import { describe, expect, it } from "vitest";
import {
  buildGeneratedMediaAltText,
  buildGeneratedMediaPreviewPath,
  buildGeneratedMediaSeoFilename,
  sanitizeSeoFilename,
} from "@/lib/ecomviper/walmart/walmart-generated-media-seo";

describe("Walmart generated media SEO helpers", () => {
  it("builds an SEO filename from brand/title/sku/type", () => {
    const filename = buildGeneratedMediaSeoFilename({
      brand: "OPA Nutrition",
      productTitle: "Platinum Turmeric Joint Support Plus",
      sku: "ROC725",
      imageType: "supplement_facts",
      mimeType: "image/png",
    });

    expect(filename).toBe(
      "opa-nutrition-platinum-turmeric-joint-support-plus-roc725-supplement-facts.png"
    );
  });

  it("sanitizes unsafe filename characters and normalizes extension", () => {
    const filename = sanitizeSeoFilename(
      " OPA Nutrition ### Turmeric & Joint+++ Support!!.JPEG ",
      "image/jpeg"
    );

    expect(filename).toBe("opa-nutrition-turmeric-joint-support.jpg");
  });

  it("builds alt text without inventing claims", () => {
    const supplementAlt = buildGeneratedMediaAltText({
      brand: "OPA Nutrition",
      productTitle: "Platinum Turmeric Joint Support Plus",
      sku: "ROC725",
      imageType: "supplement_facts",
    });
    const lifestyleAlt = buildGeneratedMediaAltText({
      brand: "OPA Nutrition",
      productTitle: "Platinum Turmeric Joint Support Plus",
      sku: "ROC725",
      imageType: "lifestyle",
    });

    expect(supplementAlt).toContain("supplement facts image");
    expect(lifestyleAlt).toContain("lifestyle product image for Walmart listing");
    expect(supplementAlt.toLowerCase()).not.toContain("cure");
    expect(lifestyleAlt.toLowerCase()).not.toContain("treat");
  });

  it("builds SEO-compatible generated-media preview paths", () => {
    const path = buildGeneratedMediaPreviewPath(
      "ev_wm_img_abc123",
      "opa-nutrition-roc725-lifestyle.png"
    );

    expect(path).toBe(
      "/api/ecomviper/walmart/generated-media/ev_wm_img_abc123/opa-nutrition-roc725-lifestyle.png"
    );
  });
});
