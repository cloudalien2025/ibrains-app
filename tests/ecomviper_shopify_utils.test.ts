import { describe, expect, it } from "vitest";
import {
  buildShopifyOauthHmacMessage,
  normalizeShopDomain,
  verifyShopifyCallbackHmac,
} from "../app/api/ecomviper/_utils/shopify";
import crypto from "crypto";

describe("shop domain normalization", () => {
  it("normalizes valid domain input", () => {
    expect(normalizeShopDomain("HTTPS://OpaNutrition.MyShopify.com/admin")).toBe(
      "opanutrition.myshopify.com"
    );
  });

  it("rejects invalid domain input", () => {
    expect(() => normalizeShopDomain("not a domain")).toThrow("Invalid shop domain");
  });
});

describe("Shopify callback HMAC verification", () => {
  it("verifies with sorted url-encoded message", () => {
    const params = new URLSearchParams({
      shop: "opanutrition.myshopify.com",
      code: "abc123",
      state: "state1",
      timestamp: "1700000000",
    });

    const secret = "shpss_test_secret";
    const message = buildShopifyOauthHmacMessage(params);
    const digest = crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
    params.set("hmac", digest);

    expect(verifyShopifyCallbackHmac(params, secret)).toBe(true);

    params.set("hmac", "deadbeef");
    expect(verifyShopifyCallbackHmac(params, secret)).toBe(false);
  });
});
