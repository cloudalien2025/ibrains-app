import ListingOptimizationClient from "./listing-optimization-client";

export const dynamic = "force-dynamic";

export default async function DirectoryIqListingOptimizationPage({
  params,
}: {
  params: { listingId: string };
}) {
  const listingId = decodeURIComponent(params.listingId);

  return (
    <ListingOptimizationClient
      listingId={listingId}
      initialListing={null}
      initialIntegrations={{ openaiConfigured: false, bdConfigured: false }}
      initialError={null}
    />
  );
}
