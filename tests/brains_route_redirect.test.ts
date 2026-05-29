import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("brains route redirect", () => {
  it("server-redirects /brains to /ecomviper", async () => {
    const pageMod = await import("@/app/(shell)/brains/page");

    await pageMod.default();

    expect(redirectMock).toHaveBeenCalledWith("/ecomviper");
  });
});
