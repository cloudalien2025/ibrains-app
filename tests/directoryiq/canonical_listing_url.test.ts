import { describe, expect, it } from "vitest";
import { resolveCanonicalListingUrl } from "@/app/api/directoryiq/_utils/canonicalListingUrl";

describe("canonical listing URL resolver", () => {
  it("resolves canonical URL from fallback fields in stable order", () => {
    const url = resolveCanonicalListingUrl(
      {
        listing_url: "",
        profile_url: "https://www.vailvacay.com/listings/tivoli-lodge",
        permalink: "https://example.com/permalink",
      },
      null
    );

    expect(url).toBe("https://www.vailvacay.com/listings/tivoli-lodge");
  });

  it("returns null when no truthful canonical URL exists", () => {
    const url = resolveCanonicalListingUrl(
      {
        listing_url: " ",
        profile_url: "",
        permalink: "",
      },
      null
    );

    expect(url).toBeNull();
  });

  it("composes canonical URL from site base and listing path fields", () => {
    const url = resolveCanonicalListingUrl(
      {
        group_filename: "listings/cedar-at-streamside",
      },
      null,
      "www.vailvacay.com"
    );

    expect(url).toBe("https://www.vailvacay.com/listings/cedar-at-streamside");
  });
});
