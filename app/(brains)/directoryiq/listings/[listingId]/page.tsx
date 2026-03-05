import { headers } from "next/headers";
import ListingOptimizationClient from "./listing-optimization-client";

type ListingDetailResponse = {
  listing: {
    listing_id: string;
    listing_name: string;
    listing_url: string | null;
    mainImageUrl: string | null;
  };
  evaluation: {
    totalScore: number;
  };
};

type IntegrationStatusResponse = {
  openaiConfigured: boolean;
  bdConfigured: boolean;
};

type ApiErrorShape = {
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
    details?: string;
  };
};

type UiError = {
  message: string;
  reqId?: string;
  code?: string;
};

function parseError(json: ApiErrorShape, fallback: string): UiError {
  return {
    message: json.error?.message ?? fallback,
    reqId: json.error?.reqId,
    code: json.error?.code,
  };
}

async function loadListingAndIntegrations(listingId: string): Promise<{
  listing: ListingDetailResponse | null;
  integrations: IntegrationStatusResponse;
  error: UiError | null;
}> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  try {
    const [listingRes, integrationRes] = await Promise.all([
      fetch(`${baseUrl}/api/directoryiq/listings/${encodeURIComponent(listingId)}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/directoryiq/integrations`, { cache: "no-store" }),
    ]);

    const listingJson = (await listingRes.json().catch(() => ({}))) as ListingDetailResponse & ApiErrorShape;
    const integrationJson = (await integrationRes.json().catch(() => ({}))) as IntegrationStatusResponse & ApiErrorShape;

    const listing = listingRes.ok ? listingJson : null;
    const error = listingRes.ok ? null : parseError(listingJson, "Failed to load listing details.");

    const integrations = integrationRes.ok
      ? {
          openaiConfigured: integrationJson.openaiConfigured,
          bdConfigured: integrationJson.bdConfigured,
        }
      : { openaiConfigured: false, bdConfigured: false };

    return { listing, integrations, error };
  } catch (e) {
    return {
      listing: null,
      integrations: { openaiConfigured: false, bdConfigured: false },
      error: { message: e instanceof Error ? e.message : "Failed to load listing details." },
    };
  }
}

export const dynamic = "force-dynamic";

export default async function DirectoryIqListingOptimizationPage({
  params,
}: {
  params: { listingId: string };
}) {
  const listingId = decodeURIComponent(params.listingId);
  const { listing, integrations, error } = await loadListingAndIntegrations(listingId);

  return (
    <ListingOptimizationClient
      listingId={listingId}
      initialListing={listing}
      initialIntegrations={integrations}
      initialError={error}
    />
  );
}
