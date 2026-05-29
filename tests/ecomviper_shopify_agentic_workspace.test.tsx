import { describe, expect, it } from "vitest";
import EcomViperShopifyPage from "@/app/ecomviper/shopify/page";

describe("Shopify workspace route", () => {
  it("redirects /ecomviper/shopify to /ecomviper/settings", async () => {
    await expect(
      EcomViperShopifyPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("preserves demo query param when redirecting", async () => {
    await expect(
      EcomViperShopifyPage({
        searchParams: Promise.resolve({ demo: "1" }),
      })
    ).rejects.toMatchObject({
      digest: expect.stringContaining("/ecomviper/settings?demo=1"),
    });
  });
});
