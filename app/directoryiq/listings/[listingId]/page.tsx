import ListingOptimizationClient from "./listing-optimization-client";

export const dynamic = "force-dynamic";

export default async function DirectoryIqListingOptimizationPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const decodedListingId = decodeURIComponent(listingId);

  return (
    <ListingOptimizationClient
      listingId={decodedListingId}
      initialListing={null}
      initialIntegrations={{ openaiConfigured: null, bdConfigured: null }}
      initialError={null}
    />
  );
}
