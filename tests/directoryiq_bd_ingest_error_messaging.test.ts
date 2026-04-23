import { describe, expect, it } from "vitest";
import { BdIngestError } from "@/app/api/directoryiq/_utils/ingest";
import { classifyBdIngestFailure } from "@/app/api/directoryiq/_utils/bdIngestErrorMessaging";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";

describe("directoryiq bd ingest error classification", () => {
  it("classifies missing site fields", () => {
    const error = new BdIngestError({
      code: "bd_integration_missing",
      baseUrlPresent: false,
      apiKeyPresent: false,
      listingsPathPresent: false,
      listingsDataIdPresent: false,
      listingsDataIdValue: null,
    });
    const classified = classifyBdIngestFailure(error);
    expect(classified.family).toBe("missing_or_invalid_site_fields");
    expect(classified.userMessage.toLowerCase()).toContain("incomplete");
  });

  it("classifies invalid api key", () => {
    const error = new BdIngestError({
      code: "bd_integration_invalid",
      baseUrlPresent: true,
      apiKeyPresent: true,
      listingsPathPresent: true,
      listingsDataIdPresent: true,
      listingsDataIdValue: 75,
      statusCode: 401,
      messageSnippet: "Unauthorized: invalid API key",
      endpoint: "/api/v2/users_portfolio_groups/search",
    });
    const classified = classifyBdIngestFailure(error);
    expect(classified.family).toBe("invalid_api_key");
  });

  it("classifies invalid listings path", () => {
    const error = new BdIngestError({
      code: "bd_request_failed",
      baseUrlPresent: true,
      apiKeyPresent: true,
      listingsPathPresent: true,
      listingsDataIdPresent: true,
      listingsDataIdValue: 75,
      statusCode: 404,
      messageSnippet: "Not Found",
      endpoint: "/api/v2/bad-path",
    });
    const classified = classifyBdIngestFailure(error);
    expect(classified.family).toBe("invalid_listings_path");
  });

  it("classifies invalid listings post type id", () => {
    const error = new BdIngestError({
      code: "bd_post_type_invalid",
      baseUrlPresent: true,
      apiKeyPresent: true,
      listingsPathPresent: true,
      listingsDataIdPresent: true,
      listingsDataIdValue: 999,
      dataTypeObserved: "14",
    });
    const classified = classifyBdIngestFailure(error);
    expect(classified.family).toBe("invalid_listings_data_id");
  });
});

describe("directoryiq undefined relation detection", () => {
  it("accepts pg 42P01 code", () => {
    const error = Object.assign(new Error("whatever"), { code: "42P01" });
    expect(isUndefinedRelationError(error, "integrations_credentials")).toBe(true);
  });

  it("accepts schema-qualified relation message", () => {
    const error = new Error('relation "public.integrations_credentials" does not exist');
    expect(isUndefinedRelationError(error, "integrations_credentials")).toBe(true);
  });
});

