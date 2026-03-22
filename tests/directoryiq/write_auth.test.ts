import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn(async () => {});
const resolveUserIdMock = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const ORIGINAL_E2E_MOCK_GRAPH = process.env.E2E_MOCK_GRAPH;

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

describe("directoryiq write auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof ORIGINAL_E2E_MOCK_GRAPH === "string") {
      process.env.E2E_MOCK_GRAPH = ORIGINAL_E2E_MOCK_GRAPH;
    } else {
      delete process.env.E2E_MOCK_GRAPH;
    }
  });

  it("bypasses DB-backed ensureUser in E2E_MOCK_GRAPH mode", async () => {
    process.env.E2E_MOCK_GRAPH = "1";
    const { requireDirectoryIqWriteUser } = await import("@/app/api/directoryiq/_utils/writeAuth");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/generate");

    const userId = await requireDirectoryIqWriteUser(req);
    expect(userId).toBe("00000000-0000-4000-8000-000000000001");
    expect(resolveUserIdMock).toHaveBeenCalledTimes(1);
    expect(ensureUserMock).not.toHaveBeenCalled();
  });

  it("keeps normal ensureUser behavior outside mock graph mode", async () => {
    delete process.env.E2E_MOCK_GRAPH;
    const { requireDirectoryIqWriteUser } = await import("@/app/api/directoryiq/_utils/writeAuth");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/generate");

    const userId = await requireDirectoryIqWriteUser(req);
    expect(userId).toBe("00000000-0000-4000-8000-000000000001");
    expect(resolveUserIdMock).toHaveBeenCalledTimes(1);
    expect(ensureUserMock).toHaveBeenCalledTimes(1);
    expect(ensureUserMock).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });
});

