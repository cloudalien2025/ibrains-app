import { describe, expect, it } from "vitest";

import {
  extractUnsupportedPolicyFieldsFromGraphqlErrors,
  extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata,
} from "@/lib/ecomviper/shopify/shopify-policy-capabilities";

describe("Shopify policy capability extraction", () => {
  it("prefers structured error.path over error.message for the same error", () => {
    const result = extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata([
      {
        message: "Field 'refundPolicy' doesn't exist on type 'Shop'",
        path: ["shop", "privacyPolicy"],
      },
    ]);

    expect(result.unsupportedPolicyFields).toEqual(["privacyPolicy"]);
    expect(result.extractionSource).toBe("path");
  });

  it("reports mixed extraction source when both path and message fallback are used", () => {
    const result = extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata([
      {
        path: ["shop", "shippingPolicy"],
      },
      {
        message: "Field 'termsOfService' cannot be queried on type 'Shop'",
      },
    ]);

    expect(result.unsupportedPolicyFields).toEqual(["shippingPolicy", "termsOfService"]);
    expect(result.extractionSource).toBe("mixed");
  });

  it("keeps wrapper output aligned with metadata extractor fields", () => {
    const errors = [
      {
        message: "Field 'privacyPolicy' doesn't exist on type 'Shop'",
      },
    ];
    const withMetadata = extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata(errors);
    const fieldsOnly = extractUnsupportedPolicyFieldsFromGraphqlErrors(errors);

    expect(withMetadata.unsupportedPolicyFields).toEqual(fieldsOnly);
    expect(withMetadata.extractionSource).toBe("message");
  });
});
