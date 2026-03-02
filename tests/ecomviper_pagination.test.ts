import { afterEach, describe, expect, it, vi } from "vitest";
import { paginateGraphqlNodes } from "../app/api/ecomviper/_utils/shopify";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("graphql pagination helper", () => {
  it("follows cursors across pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            products: {
              edges: [{ node: { id: "p1" } }],
              pageInfo: { hasNextPage: true, endCursor: "c1" },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            products: {
              edges: [{ node: { id: "p2" } }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const nodes = await paginateGraphqlNodes<{ id: string }>({
      shopDomain: "opanutrition.myshopify.com",
      accessToken: "token",
      query: "query ProductsPage($first:Int!,$after:String){products(first:$first,after:$after){edges{node{id}} pageInfo{hasNextPage endCursor}}}",
      rootField: "products",
      pageSize: 1,
    });

    expect(nodes.map((node) => node.id)).toEqual(["p1", "p2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
