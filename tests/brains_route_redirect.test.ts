import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("brains route launcher", () => {
  it("renders iBrains Dashboard launcher and does not redirect to /ecomviper", async () => {
    const pageMod = await import("@/app/(shell)/brains/page");
    const html = renderToStaticMarkup(await pageMod.default());

    expect(html).toContain("iBrains Dashboard");
    expect(html).not.toContain("BrainOS");
    expect(html).toContain('data-testid="ibrains-dashboard-page"');
    expect(html).toContain(">EcomViper<");
    expect(html).toContain(">OptiBay<");
    expect(html).toContain(">OptiZon<");
    expect(html).toContain(">CasaFlix<");
    expect(html).toContain(">SiteForge<");
    expect(html).toContain(">DirectoryIQ<");
    expect(html).toContain('href="/ecomviper"');
    expect(html).toContain("lucide");
    expect(html).not.toContain("NEXT_REDIRECT");
  });
});
