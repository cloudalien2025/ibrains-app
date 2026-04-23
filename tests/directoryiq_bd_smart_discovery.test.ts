import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBdPostTypeIds } from "@/app/api/directoryiq/_utils/bdPostTypeDetection";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readDataId(init?: RequestInit): string {
  const body = init?.body;
  if (!(body instanceof URLSearchParams)) return "";
  return body.get("data_id") ?? "";
}

describe("directoryiq bd smart post-type discovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers multiple post types, auto-selects listing/blog, and leaves other roles optional", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/v2/data_categories/get?property=data_active&property_value=1")) {
          return jsonResponse({
            status: "success",
            message: [
              { data_id: 75, data_type: 4, name: "Business Listing", permalink: "/listings" },
              { data_id: 14, data_type: 7, name: "Website Blog Article", permalink: "/blog" },
              { data_id: 22, data_type: 7, name: "Video", permalink: "/videos" },
              { data_id: 31, data_type: 7, name: "Coupon", permalink: "/coupons" },
            ],
          });
        }
        if (url.endsWith("/api/v2/data_categories/get/75")) {
          return jsonResponse({ status: "success", data: { data_id: 75, data_type: 4, name: "Business Listing" } });
        }
        if (url.endsWith("/api/v2/data_categories/get/14")) {
          return jsonResponse({ status: "success", data: { data_id: 14, data_type: 7, name: "Website Blog Article" } });
        }
        if (url.endsWith("/api/v2/data_categories/get/22")) {
          return jsonResponse({ status: "success", data: { data_id: 22, data_type: 7, name: "Video" } });
        }
        if (url.endsWith("/api/v2/data_categories/get/31")) {
          return jsonResponse({ status: "success", data: { data_id: 31, data_type: 7, name: "Coupon" } });
        }
        if (url.endsWith("/api/v2/users_portfolio_groups/search")) {
          const dataId = readDataId(init);
          if (dataId === "75") {
            return jsonResponse({
              status: "success",
              data: [{ group_id: "g-1", group_name: "Summit Home Services", group_filename: "summit-home-services" }],
            });
          }
          return jsonResponse({ status: "success", data: [] });
        }
        if (url.endsWith("/api/v2/data_posts/search")) {
          const dataId = readDataId(init);
          if (dataId === "14") {
            return jsonResponse({
              status: "success",
              data: [{ post_id: "14-1", post_title: "Spring Checklist", post_filename: "spring-checklist" }],
            });
          }
          if (dataId === "22") {
            return jsonResponse({
              status: "success",
              data: [{ post_id: "22-1", post_title: "Video Walkthrough", post_filename: "video-walkthrough" }],
            });
          }
          if (dataId === "31") {
            return jsonResponse({
              status: "success",
              data: [{ post_id: "31-1", post_title: "Coupon Offer", post_filename: "coupon-offer" }],
            });
          }
          return jsonResponse({ status: "success", data: [] });
        }
        if (
          url.endsWith("/api/v2/data_post/search") ||
          url.endsWith("/api/v2/posts/search") ||
          url.endsWith("/api/v2/data_posts/list")
        ) {
          return jsonResponse({ status: "error", message: "not found" }, 404);
        }
        return jsonResponse({ status: "error" }, 404);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: null,
      configuredBlogPostsDataId: null,
    });

    expect(detected.discovery.selected.primaryListingDataId).toBe(75);
    expect(detected.discovery.selected.articleOrBlogDataId).toBe(14);
    expect(detected.discovery.compatibility.listingsDataId).toBe(75);
    expect(detected.discovery.compatibility.blogPostsDataId).toBe(14);

    const listing = detected.discovery.inventory.find((item) => item.dataId === 75);
    const blog = detected.discovery.inventory.find((item) => item.dataId === 14);
    const video = detected.discovery.inventory.find((item) => item.dataId === 22);
    const coupon = detected.discovery.inventory.find((item) => item.dataId === 31);
    expect(listing?.role).toBe("primary_listing");
    expect(blog?.role).toBe("article_or_blog");
    expect(video?.role).toBe("video");
    expect(coupon?.role).toBe("coupon");
    expect(listing?.autoEnabled).toBe(true);
    expect(blog?.autoEnabled).toBe(true);
    expect(video?.autoEnabled).toBe(false);
    expect(coupon?.autoEnabled).toBe(false);
  });
});
