import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("directoryiq publish data_type resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error test override
    global.fetch = fetchMock;
  });

  it("resolves publish data_type from data_categories/get", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { data_type: "4" } }),
    });

    const { resolveBlogPostDataTypeForPublish } = await import("@/app/api/directoryiq/_utils/integrations");
    const resolved = await resolveBlogPostDataTypeForPublish({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      blogDataId: 14,
    });

    expect(resolved).toEqual({ dataType: 4, source: "data_category_get" });
  });

  it("returns missing when category payload does not expose data_type", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { id: 14 } }),
    });

    const { resolveBlogPostDataTypeForPublish } = await import("@/app/api/directoryiq/_utils/integrations");
    const resolved = await resolveBlogPostDataTypeForPublish({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      blogDataId: 14,
    });

    expect(resolved).toEqual({ dataType: null, source: "missing" });
  });
});
