import { describe, expect, it } from "vitest";
import { applyThriveMappings } from "@/lib/siteforge/thrive";
import { BuildSpec } from "@/lib/siteforge/contracts";

function buildSpec(): BuildSpec {
  return {
    siteTitle: "Acme",
    homepageSlug: "landing-page",
    menu: [
      { label: "Home", slug: "landing-page" },
      { label: "Contact", slug: "contact" },
    ],
    pages: [
      {
        pageId: "p1",
        title: "Home",
        slug: "landing-page",
        purpose: "home",
        sections: [],
        metadata: { template: "landing" },
      },
      {
        pageId: "p2",
        title: "Contact",
        slug: "contact",
        purpose: "contact",
        sections: [],
        metadata: { template: "contact" },
      },
    ],
    metadata: {
      conversionFocus: "high",
      thriveAware: true,
      createdAt: "2026-04-19T00:00:00.000Z",
    },
  };
}

describe("siteforge thrive homepage mapping", () => {
  it("maps canonical homepage by homepageSlug with explicit homepage role metadata", () => {
    const translated = applyThriveMappings(buildSpec(), true);

    const homepage = translated.spec.pages.find((page) => page.slug === "landing-page");
    const contact = translated.spec.pages.find((page) => page.slug === "contact");

    expect(homepage?.metadata.thriveLayoutKey).toBe("thrive-homepage-canonical");
    expect(homepage?.metadata.thrivePageRole).toBe("homepage");

    expect(contact?.metadata.thriveLayoutKey).toBe("thrive-standard-content");
    expect(contact?.metadata.thrivePageRole).toBe("content");
    expect(translated.appliedMappings).toContain("landing-page:thrive-homepage-canonical:homepage");
  });
});
