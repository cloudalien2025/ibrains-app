import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn(async () => []);

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSiteRows: vi.fn(async () => []),
}));

describe("directoryiq authority slot persistence contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures exactly five authority slots using one-based indexing", async () => {
    const { ensureAuthoritySlots } = await import("@/app/api/directoryiq/_utils/selectionData");

    await ensureAuthoritySlots("u1", "site-1:321");

    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls.map((call) => call[1]?.[2])).toEqual([1, 2, 3, 4, 5]);
  });
});
