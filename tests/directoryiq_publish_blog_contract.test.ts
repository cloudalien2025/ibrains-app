import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("directoryiq publishBlogPostToBd contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error test override
    global.fetch = fetchMock;
  });

  it("sends BD-required user_id and data_type for data_posts/create", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { post_id: "900" } }),
    });

    const { publishBlogPostToBd } = await import("@/app/api/directoryiq/_utils/integrations");
    await publishBlogPostToBd({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      dataPostsCreatePath: "/api/v2/data_posts/create",
      blogDataId: 14,
      bdUserId: "321",
      title: "Fixture title",
      html: "<p>Fixture body</p>",
      featuredImageUrl: null,
      seoPackage: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body =
      init.body instanceof URLSearchParams
        ? init.body
        : new URLSearchParams((init.body as string | undefined) ?? "");

    expect(init.method).toBe("POST");
    expect(body.get("user_id")).toBe("321");
    expect(body.get("data_type")).toBe("14");
    expect(body.get("data_id")).toBe("14");
    expect(body.get("post_title")).toBe("Fixture title");
  });
});
