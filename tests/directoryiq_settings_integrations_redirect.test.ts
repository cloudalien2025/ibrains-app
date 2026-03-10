import { beforeEach, describe, expect, it, vi } from "vitest";

const permanentRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  permanentRedirect,
}));

describe("directoryiq settings integrations redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects old integrations route to signal sources", async () => {
    const page = await import("@/app/(brains)/directoryiq/settings/integrations/page");
    await page.default({});

    expect(permanentRedirect).toHaveBeenCalledWith("/directoryiq/signal-sources");
  });

  it("preserves connector query when redirecting", async () => {
    const page = await import("@/app/(brains)/directoryiq/settings/integrations/page");
    await page.default({ searchParams: { connector: "openai" } });

    expect(permanentRedirect).toHaveBeenCalledWith("/directoryiq/signal-sources?connector=openai");
  });
});
