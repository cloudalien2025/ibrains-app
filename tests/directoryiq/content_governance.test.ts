import { describe, expect, it } from "vitest";
import { ensureContextualListingLink, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";

describe("directoryiq content governance", () => {
  it("keeps drafts valid when listing URL is already present as an in-body anchor", () => {
    const listingUrl = "https://example.com/listings/acme";
    const html = `Intro paragraph with <a href="${listingUrl}">listing</a>.`;
    const processed = ensureContextualListingLink({
      html,
      listingUrl,
      listingTitle: "Acme Listing",
      focusTopic: "acme topic",
    });
    expect(processed).toBe(html);
    expect(validateDraftHtml({ html: processed, listingUrl }).valid).toBe(true);
  });

  it("deterministically adds a contextual listing link when model output omits it", () => {
    const listingUrl = "https://example.com/listings/acme";
    const processed = ensureContextualListingLink({
      html: "Draft text without the required URL.",
      listingUrl,
      listingTitle: "Acme Listing",
      focusTopic: "acme topic",
    });
    expect(processed).toContain(listingUrl);
    expect(processed).toContain(`<a href="${listingUrl}">Acme Listing</a>`);
    expect(processed).toContain("For acme topic");
    expect(validateDraftHtml({ html: processed, listingUrl }).valid).toBe(true);
  });

  it("adds an anchor when draft only contains a bare listing URL", () => {
    const listingUrl = "https://example.com/listings/acme";
    const processed = ensureContextualListingLink({
      html: `Draft text with bare URL: ${listingUrl}`,
      listingUrl,
      listingTitle: "Acme Listing",
      focusTopic: "acme topic",
    });
    expect(processed).toContain(`<a href="${listingUrl}">Acme Listing</a>`);
    expect(validateDraftHtml({ html: processed, listingUrl }).valid).toBe(true);
  });

  it("accepts contextual anchors when href uses HTML-escaped URL entities", () => {
    const listingUrl = "https://example.com/listings/acme?x=1&y=2";
    const html = `<p>For details see <a href="https://example.com/listings/acme?x=1&amp;y=2">Acme</a>.</p>`;
    const validation = validateDraftHtml({ html, listingUrl });
    expect(validation.valid).toBe(true);
    expect(validation.hasContextualListingLink).toBe(true);
  });

  it("still fails governance when listing URL is unavailable", () => {
    const processed = ensureContextualListingLink({
      html: "Draft text with no resolvable listing URL.",
      listingUrl: "",
      listingTitle: "Acme Listing",
      focusTopic: "acme topic",
    });
    const validation = validateDraftHtml({ html: processed, listingUrl: "" });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Draft must include a contextual in-body link to the listing URL.");
  });
});
