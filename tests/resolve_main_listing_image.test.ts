import { describe, expect, it } from "vitest";
import { resolveMainListingImage } from "@/src/lib/bd/resolveMainListingImage";

describe("resolveMainListingImage", () => {
  it("resolves from group get payload when message is an object", async () => {
    const fetchBdJson = async ({ path }: { method: "GET" | "POST"; path: string; form?: Record<string, string | number> }) => {
      if (path === "/api/v2/users_portfolio_groups/search") {
        return { status: "error", message: "Post Type not found!" };
      }
      if (path === "/api/v2/users_portfolio_groups/get/1") {
        return {
          status: "success",
          message: {
            users_portfolio: [{ photo_id: "10", file_main_full_url: "https://example.com/photos/main/a.webp" }],
          },
        };
      }
      return null;
    };

    const result = await resolveMainListingImage({
      bdBaseUrl: "https://example.com",
      userPayload: { user_id: "1" },
      fetchBdJson,
    });

    expect(result.url).toBe("https://example.com/photos/main/a.webp");
    expect(result.source).toBe("portfolio.group");
  });

  it("resolves from group get payload when message is an array", async () => {
    const fetchBdJson = async ({ path }: { method: "GET" | "POST"; path: string; form?: Record<string, string | number> }) => {
      if (path === "/api/v2/users_portfolio_groups/search") {
        return { status: "success", message: [{ group_id: "55" }] };
      }
      if (path === "/api/v2/users_portfolio_groups/get/55") {
        return {
          status: "success",
          message: [
            {
              group_id: "55",
              users_portfolio: [{ photo_id: "11", file_main_full_url: "https://example.com/photos/main/b.webp" }],
            },
          ],
        };
      }
      return null;
    };

    const result = await resolveMainListingImage({
      bdBaseUrl: "https://example.com",
      userPayload: { user_id: "1" },
      fetchBdJson,
    });

    expect(result.url).toBe("https://example.com/photos/main/b.webp");
    expect(result.source).toBe("portfolio.group");
  });
});
