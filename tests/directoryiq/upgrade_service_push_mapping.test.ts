import { beforeEach, describe, expect, it, vi } from "vitest";

const getDraft = vi.fn();
const markPushed = vi.fn();
const writeAuditEvent = vi.fn();
const verifyApprovalToken = vi.fn();
const getListingFacts = vi.fn();
const getBdConnection = vi.fn();
const requestBd = vi.fn();
const resolveTruePostIdForListing = vi.fn();

vi.mock("@/src/directoryiq/repositories/upgradeDraftRepo", () => ({
  getDraft,
  markPushed,
  createDraft: vi.fn(),
  hashText: vi.fn(),
  markPreviewed: vi.fn(),
}));

vi.mock("@/src/directoryiq/repositories/auditRepo", () => ({
  writeAuditEvent,
}));

vi.mock("@/src/directoryiq/services/tokenService", () => ({
  issueApprovalToken: vi.fn(),
  verifyApprovalToken,
}));

vi.mock("@/src/directoryiq/services/listingService", () => ({
  getListingFacts,
}));

vi.mock("@/src/directoryiq/services/integrationsService", () => ({
  getBdConnection,
  getIntegrationStatus: vi.fn(),
  getOpenAiKey: vi.fn(),
}));

vi.mock("@/src/directoryiq/adapters/bd/bdClient", () => ({
  requestBd,
}));

vi.mock("@/app/api/directoryiq/_utils/integrations", () => ({
  resolveTruePostIdForListing,
}));

describe("upgradeService push mapping resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyApprovalToken.mockReturnValue({ ok: true });
    getDraft.mockResolvedValue({
      id: "draft-1",
      listingId: "site-1:321",
      userId: "user-1",
      status: "previewed",
      proposedText: "Improved description",
    });
    getListingFacts.mockResolvedValue({
      listingId: "site-1:321",
      title: "Fixture Listing",
      url: "https://example.com/listings/fixture-listing",
      description: "Original",
      raw: {
        group_name: "Fixture Listing",
        group_filename: "fixture-listing",
      },
      allowedFacts: {},
    });
    getBdConnection.mockResolvedValue({
      baseUrl: "https://bd.example.com",
      apiKey: "key",
      updatePath: "/api/v2/data_posts/update",
      dataPostsSearchPath: "/api/v2/data_posts/search",
      listingsDataId: 75,
    });
    requestBd.mockResolvedValue({
      ok: true,
      status: 200,
      json: { status: "success" },
    });
  });

  it("uses persisted true_post_id before resolver fallback", async () => {
    getListingFacts.mockResolvedValueOnce({
      listingId: "site-1:321",
      title: "Fixture Listing",
      url: "https://example.com/listings/fixture-listing",
      description: "Original",
      raw: {
        true_post_id: "902",
        group_name: "Fixture Listing",
        group_filename: "fixture-listing",
      },
      allowedFacts: {},
    });
    const { pushUpgrade } = await import("@/src/directoryiq/services/upgradeService");

    const result = await pushUpgrade("user-1", "site-1:321", "draft-1", true, "token");

    expect(result.ok).toBe(true);
    expect(resolveTruePostIdForListing).not.toHaveBeenCalled();
    expect(requestBd).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        form: expect.objectContaining({ post_id: "902" }),
      })
    );
  });

  it("resolves mapping from canonical resolver when true_post_id is absent", async () => {
    resolveTruePostIdForListing.mockResolvedValueOnce({ truePostId: "903", mappingKey: "slug" });
    const { pushUpgrade } = await import("@/src/directoryiq/services/upgradeService");

    const result = await pushUpgrade("user-1", "site-1:321", "draft-1", true, "token");

    expect(result.ok).toBe(true);
    expect(resolveTruePostIdForListing).toHaveBeenCalledWith({
      baseUrl: "https://bd.example.com",
      apiKey: "key",
      dataPostsSearchPath: "/api/v2/data_posts/search",
      listingsDataId: 75,
      listingId: "site-1:321",
      listingSlug: "fixture-listing",
      listingTitle: "Fixture Listing",
    });
    expect(requestBd).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        form: expect.objectContaining({ post_id: "903" }),
      })
    );
  });

  it("fails with BD_MAPPING_MISSING when no safe mapping exists", async () => {
    resolveTruePostIdForListing.mockResolvedValueOnce({ truePostId: null, mappingKey: "unresolved" });
    const { pushUpgrade } = await import("@/src/directoryiq/services/upgradeService");

    await expect(pushUpgrade("user-1", "site-1:321", "draft-1", true, "token")).rejects.toMatchObject({
      code: "BD_MAPPING_MISSING",
      status: 422,
    });
    expect(requestBd).not.toHaveBeenCalled();
  });
});
