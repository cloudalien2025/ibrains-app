import { beforeEach, describe, expect, it, vi } from "vitest";

const findListingCandidates = vi.fn();
const getListingEvaluation = vi.fn();

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  findListingCandidates,
  getListingEvaluation,
}));

describe("listingResolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the single real candidate site even when the newest row has null site_id", async () => {
    findListingCandidates.mockResolvedValue([
      {
        sourceId: "3",
        siteId: null,
        siteLabel: null,
      },
      {
        sourceId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:3",
        siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        siteLabel: "VailVacay",
      },
    ]);
    getListingEvaluation.mockResolvedValue({
      listing: {
        source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:3",
      },
      evaluation: { totalScore: 71 },
    });

    const { resolveListingEvaluation } = await import("@/app/api/directoryiq/_utils/listingResolve");
    const result = await resolveListingEvaluation({
      userId: "user-1",
      listingId: "3",
    });

    expect(getListingEvaluation).toHaveBeenCalledWith(
      "user-1",
      "3",
      "5c82f5c1-a45f-4b25-a0d4-1b749d962415"
    );
    expect(result?.siteId).toBe("5c82f5c1-a45f-4b25-a0d4-1b749d962415");
  });
});
