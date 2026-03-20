import { queryDb } from "@/src/directoryiq/repositories/db";

export type ListingMappingKey = "slug" | "title";

export async function persistListingTruePostMapping(params: {
  userId: string;
  listingId: string;
  truePostId: string;
  mappingKey: ListingMappingKey;
}): Promise<void> {
  const truePostId = params.truePostId.trim();
  if (!truePostId) return;

  await queryDb(
    `
    UPDATE directoryiq_nodes
    SET raw_json = COALESCE(raw_json, '{}'::jsonb) || jsonb_build_object('true_post_id', $3, 'mapping_key', $4)
    WHERE user_id = $1
      AND source_type = 'listing'
      AND source_id = $2
    `,
    [params.userId, params.listingId, truePostId, params.mappingKey]
  );
}
