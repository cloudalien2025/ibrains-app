import { findListingCandidates, getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";

export class ListingSiteRequiredError extends Error {
  candidates: Array<{ siteId: string; siteLabel: string | null }>;

  constructor(candidates: Array<{ siteId: string; siteLabel: string | null }>) {
    super("site_required");
    this.name = "ListingSiteRequiredError";
    this.candidates = candidates;
  }
}

export async function resolveListingEvaluation(params: {
  userId: string;
  listingId: string;
  siteId?: string | null;
}): Promise<{
  siteId: string | null;
  listingEval: Awaited<ReturnType<typeof getListingEvaluation>>;
} | null> {
  let resolvedSiteId = params.siteId ?? null;
  let listingId = params.listingId;

  if (!resolvedSiteId && listingId.includes(":")) {
    const [prefix, rest] = listingId.split(":", 2);
    if (prefix && rest) {
      const prefixedEval = await getListingEvaluation(params.userId, rest, prefix);
      if (prefixedEval.listing) {
        return { siteId: prefix, listingEval: prefixedEval };
      }
    }
  }

  if (!resolvedSiteId) {
    const rows = await findListingCandidates(params.userId, listingId);
    if (rows.length === 0) return null;
    const uniqueSites = new Map<string, string | null>();
    for (const row of rows) {
      if (row.siteId) uniqueSites.set(row.siteId, row.siteLabel ?? null);
    }
    if (uniqueSites.size > 1) {
      throw new ListingSiteRequiredError(
        Array.from(uniqueSites.entries()).map(([siteId, siteLabel]) => ({
          siteId,
          siteLabel,
        }))
      );
    }
    resolvedSiteId = rows[0]?.siteId ?? null;
  }

  const listingEval = await getListingEvaluation(params.userId, listingId, resolvedSiteId ?? undefined);
  if (!listingEval.listing) return null;

  return { siteId: resolvedSiteId, listingEval };
}
