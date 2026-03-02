import { describe, expect, it } from "vitest";
import { normalizeBdUrl } from "@/src/lib/images/normalizeBdUrl";

describe("normalizeBdUrl", () => {
  const bdBaseUrl = "https://www.vailvacay.com/";

  it("returns null for null/empty", () => {
    expect(normalizeBdUrl({ bdBaseUrl, value: null })).toBeNull();
    expect(normalizeBdUrl({ bdBaseUrl, value: "" })).toBeNull();
    expect(normalizeBdUrl({ bdBaseUrl, value: "   " })).toBeNull();
  });

  it("returns absolute URLs unchanged", () => {
    expect(normalizeBdUrl({ bdBaseUrl, value: "https://cdn.example.com/a.webp" })).toBe("https://cdn.example.com/a.webp");
    expect(normalizeBdUrl({ bdBaseUrl, value: "http://cdn.example.com/b.webp" })).toBe("http://cdn.example.com/b.webp");
  });

  it("prefixes protocol-relative URLs with https", () => {
    expect(normalizeBdUrl({ bdBaseUrl, value: "//cdn.example.com/a.webp" })).toBe("https://cdn.example.com/a.webp");
  });

  it("joins root-relative URLs to BD base URL", () => {
    expect(normalizeBdUrl({ bdBaseUrl, value: "/photos/main/a.webp" })).toBe("https://www.vailvacay.com/photos/main/a.webp");
  });

  it("joins non-root relative URLs to BD base URL", () => {
    expect(normalizeBdUrl({ bdBaseUrl, value: "forms/hero.png" })).toBe("https://www.vailvacay.com/forms/hero.png");
    expect(normalizeBdUrl({ bdBaseUrl, value: "uploads/hero.png" })).toBe("https://www.vailvacay.com/uploads/hero.png");
    expect(normalizeBdUrl({ bdBaseUrl, value: "images/hero.png" })).toBe("https://www.vailvacay.com/images/hero.png");
    expect(normalizeBdUrl({ bdBaseUrl, value: "assets/hero.png" })).toBe("https://www.vailvacay.com/assets/hero.png");
    expect(normalizeBdUrl({ bdBaseUrl, value: "user_images/hero.png" })).toBe("https://www.vailvacay.com/user_images/hero.png");
    expect(normalizeBdUrl({ bdBaseUrl, value: "relative/other.png" })).toBe("https://www.vailvacay.com/relative/other.png");
  });
});
