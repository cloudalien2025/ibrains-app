import type { BdIngestError } from "@/app/api/directoryiq/_utils/ingest";

export type BdIngestFailureFamily =
  | "missing_or_invalid_site_fields"
  | "invalid_api_key"
  | "invalid_listings_path"
  | "invalid_listings_data_id"
  | "bd_endpoint_request_failure";

function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function looksLikeAuthFailure(error: BdIngestError): boolean {
  if (error.statusCode === 401 || error.statusCode === 403) return true;
  const snippet = lower(error.messageSnippet);
  return (
    snippet.includes("api key") ||
    snippet.includes("x-api-key") ||
    snippet.includes("unauthorized") ||
    snippet.includes("forbidden") ||
    snippet.includes("authentication")
  );
}

function looksLikeBadPath(error: BdIngestError): boolean {
  if (error.statusCode === 404) return true;
  const snippet = lower(error.messageSnippet);
  return (
    snippet.includes("not found") ||
    snippet.includes("invalid endpoint") ||
    snippet.includes("unknown endpoint") ||
    snippet.includes("route not found")
  );
}

function summarizeMissingFields(error: BdIngestError): string[] {
  const missing: string[] = [];
  if (!error.baseUrlPresent) missing.push("base URL");
  if (!error.apiKeyPresent) missing.push("API key");
  if (!error.listingsPathPresent) missing.push("listings path");
  if (!error.listingsDataIdPresent) missing.push("listings post type ID");
  return missing;
}

export function classifyBdIngestFailure(error: BdIngestError): {
  family: BdIngestFailureFamily;
  userMessage: string;
} {
  const missing = summarizeMissingFields(error);
  if (missing.length > 0 || error.code === "bd_integration_missing") {
    return {
      family: "missing_or_invalid_site_fields",
      userMessage: `Site configuration is incomplete. Add ${missing.length ? missing.join(", ") : "base URL, API key, listings path, and listings post type ID"} on Signal Sources.`,
    };
  }

  if (error.code === "bd_post_type_invalid") {
    const configured = error.listingsDataIdValue != null ? ` (${error.listingsDataIdValue})` : "";
    return {
      family: "invalid_listings_data_id",
      userMessage: `Listings Post Type ID${configured} is invalid for this Brilliant Directories site. Verify it in BD admin and update Signal Sources.`,
    };
  }

  if (error.code === "bd_integration_invalid" && looksLikeAuthFailure(error)) {
    return {
      family: "invalid_api_key",
      userMessage: "Brilliant Directories API key is missing or invalid. Update the site API key in Signal Sources and test again.",
    };
  }

  if ((error.code === "bd_integration_invalid" || error.code === "bd_request_failed") && looksLikeBadPath(error)) {
    return {
      family: "invalid_listings_path",
      userMessage: `Listings path is invalid or unreachable (${error.endpoint ?? "unknown path"}). Verify the configured listings endpoint in Signal Sources.`,
    };
  }

  return {
    family: "bd_endpoint_request_failure",
    userMessage: "Brilliant Directories request failed. Verify base URL, endpoint availability, and BD API response shape, then retry.",
  };
}

