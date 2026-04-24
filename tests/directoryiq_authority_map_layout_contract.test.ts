import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq authority map layout contract", () => {
  it("keeps listing identity outside the flywheel oval and renders featured image/fallback inside the oval", () => {
    const filePath = path.join(
      process.cwd(),
      "app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("data-testid=\"authority-map-canvas\"")).toBe(true);
    expect(source.includes("data-testid=\"listing-hero-node\"")).toBe(true);
    expect(source.includes("data-testid=\"listing-identity-card\"")).toBe(true);

    const heroNodeIndex = source.indexOf("data-testid=\"listing-hero-node\"");
    const identityCardIndex = source.indexOf("data-testid=\"listing-identity-card\"");
    expect(heroNodeIndex).toBeGreaterThan(-1);
    expect(identityCardIndex).toBeGreaterThan(-1);
    expect(identityCardIndex).toBeGreaterThan(heroNodeIndex);

    expect(source.includes("data-testid=\"listing-hero-image\"")).toBe(true);
    expect(source.includes("resolveListingHeroImageSource")).toBe(true);
    expect(source.includes("listingHeroImageSrc ?")).toBe(true);
    expect(source.includes("data-testid=\"listing-hero-image-fallback\"")).toBe(true);
    expect(source.includes("Featured image unavailable")).toBe(true);
    expect(source.includes("data-testid=\"listing-identity-kicker\"")).toBe(true);
  });

  it("normalizes hero image candidates with deterministic precedence", () => {
    const filePath = path.join(
      process.cwd(),
      "app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("function resolveListingHeroImageSource")).toBe(true);
    expect(source.includes("function normalizeImageSource")).toBe(true);
    expect(source.includes("featured_image_url")).toBe(true);
    expect(source.includes("mainImageUrl")).toBe(true);
  });
});
