// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BrowserImportReviewClient from "@/app/apps/studio/casahud/import/review-client";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("campaignId=campaign-parser-quality"),
}));

const browserPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/114752041/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-04-30T11:15:00.000Z",
  captureVersion: "2026-04-30",
  title: "via Capaccio-Paestum 13 Capaccio Paestum. Good condition Single family villa with Terrace - immobiliare.it",
  metaDescription: "Don&#39;t miss this opportunity! Capaccio Paestum detached villa, just 500 meters from th...",
  openGraph: {
    title: "Single family villa via Capaccio-Paestum 13, Capaccio Paestum",
    description:
      "Don&#39;t miss this opportunity! Capaccio Paestum detached villa with terrace and parking near the coast.",
    image: "https://images.example.com/capaccio-og.jpg",
  },
  visibleText: `
    Price
    € 299.000
    Location
    via Capaccio-Paestum 13 Capaccio Paestum. Good condition, parking space, with terrace, independent heating,
    Address
    Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy
    Property type
    Single family villa
    Bedrooms
    4
    Bathrooms
    3
    Rooms
    4+
    Interior size
    200 m²
    Garage / Parking
    , car parking,
    Description
    Don&#39;t miss this opportunity! Capaccio Paestum detached villa with panoramic exposure just 500 meters from the town center and close to the coast.
  `,
  imageCandidates: [{ url: "https://images.example.com/capaccio-og.jpg", source: "og" as const }],
};

const immobiliareAccuracyPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-05-01T08:20:00.000Z",
  title: "Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina",
  openGraph: {
    title: "Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina",
    description:
      "Detached villa in Messina with visible facts for rooms, bathrooms, and interior surface.",
    image: "https://images.example.com/acqualadrone-og.jpg",
  },
  visibleText: `
    Single family villa Contrada Lacagnina, Acqualadrone - Sparta, Messina
    Price
    EUR 300,000
    Rooms
    5+
    Surface
    187 m2
    Bathrooms
    2
    +8 photos
    11 Photos
    1/11
    Listing ID 127142643
    Ref. 287
    Description
    Detached villa with panoramic exposure and outdoor space in the Acqualadrone area of Messina.
  `,
  imageCandidates: [{ url: "https://images.example.com/acqualadrone-og.jpg", source: "og" as const }],
};

const bookmarkletPriceDescriptionPayload = {
  version: "casahud-browser-import-v1",
  sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  canonicalUrl: "https://www.immobiliare.it/en/annunci/127142643/",
  providerHost: "www.immobiliare.it",
  capturedAt: "2026-05-01T14:30:00.000Z",
  title: "Single family villa Contrada Lacagnina, Acqualadrone - Spartà, Messina",
  openGraph: {
    title: "Single family villa Contrada Lacagnina, Acqualadrone - Spartà, Messina",
    description:
      "Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea This exceptional independent property embodies the perfect fusion of 1970s Mediterranean elegance and the privilege of",
    image: "https://images.example.com/acqualadrone-bookmarklet-og.jpg",
  },
  visibleText: `
    Single family villa Contrada Lacagnina, Acqualadrone - Spartà, Messina
    5+ rooms
    2 bathrooms
    187 m²
    +8 photos
    Description
    Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea This exceptional independent property embodies the perfect fusion of 1970s Mediterranean elegance and the privilege of
  `,
  priceCandidates: ["€ 300,000"],
  descriptionCandidates: [
    "Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea This exceptional independent property embodies the perfect fusion of 1970s Mediterranean elegance and the privilege of living on the water. Set directly on the shoreline, it offers uninterrupted sea views and private outdoor terraces.",
  ],
  imageCandidates: [{ url: "https://images.example.com/acqualadrone-bookmarklet-og.jpg", source: "og" as const }],
};

const incompleteCapturePayload = {
  ...bookmarkletPriceDescriptionPayload,
  priceCandidates: [],
  visibleText: `
    Single family villa Contrada Lacagnina, Acqualadrone - Spartà, Messina
    Description
    Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea ... privilege of
  `,
  descriptionCandidates: [
    "Exclusive Seaside Retreat in Acqualadrone – Direct Access to the Sea ... privilege of",
  ],
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaFlix browser import review client", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.name = JSON.stringify(browserPayload);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.name = "";
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows decoded description, prefilled price, cleaned location, and saves manual edits", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(
          JSON.stringify({
            ok: true,
            campaigns: [{ id: "campaign-parser-quality", name: "Parser Quality Campaign", status: "campaign_created" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/studio/domara/campaigns/campaign-parser-quality/browser-import") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, listing: { id: "listing-1", title: "Capaccio Paestum Villa" }, message: "Browser import saved." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<BrowserImportReviewClient />);
    });
    await flush();

    const descriptionPreview = container.querySelector('[data-testid="casahud-browser-import-description-preview"]');
    expect(descriptionPreview?.textContent).toContain("Don't miss this opportunity");
    expect(descriptionPreview?.textContent).not.toContain("Don&#39;t");
    expect(descriptionPreview?.textContent).toContain("500 meters from the town center");

    const priceInput = container.querySelector('[data-testid="casahud-browser-import-price-input"]') as HTMLInputElement | null;
    const locationInput = container.querySelector('[data-testid="casahud-browser-import-location-input"]') as HTMLInputElement | null;
    const descriptionInput = container.querySelector('[data-testid="casahud-browser-import-description-input"]') as HTMLTextAreaElement | null;
    expect(priceInput?.value).toBe("299000");
    expect(locationInput?.value).toBe("Via Capaccio-Paestum 13, Capaccio Paestum, Salerno, Campania, Italy");
    expect(locationInput?.value).not.toMatch(/good condition|parking|heating/i);
    expect(descriptionInput?.value).toContain("Don't miss this opportunity");

    await act(async () => {
      container.querySelector('[data-testid="casahud-browser-import-save"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const postCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/studio/domara/campaigns/campaign-parser-quality/browser-import"));
    expect(postCall).toBeDefined();
    expect(postCall?.[1]).toMatchObject({ method: "POST" });
    expect(String((postCall?.[1] as RequestInit)?.body || "")).toContain('"price":"299000"');
    expect(String((postCall?.[1] as RequestInit)?.body || "")).toContain("Don't miss this opportunity");
    expect(container.textContent || "").toContain("Browser import saved.");
  });

  it("shows corrected Immobiliare parsed fields in review UI before save", async () => {
    window.name = JSON.stringify(immobiliareAccuracyPayload);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(
          JSON.stringify({
            ok: true,
            campaigns: [{ id: "campaign-parser-quality", name: "Parser Quality Campaign", status: "campaign_created" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<BrowserImportReviewClient />);
    });
    await flush();

    const priceInput = container.querySelector('[data-testid="casahud-browser-import-price-input"]') as HTMLInputElement | null;
    const roomsInput = container.querySelector('[data-testid="casahud-browser-import-rooms-input"]') as HTMLInputElement | null;
    const bathroomsInput = container.querySelector('[data-testid="casahud-browser-import-bathrooms-input"]') as HTMLInputElement | null;
    const bedroomsInput = container.querySelector('[data-testid="casahud-browser-import-bedrooms-input"]') as HTMLInputElement | null;
    const sizeInput = container.querySelector('[data-testid="casahud-browser-import-size-input"]') as HTMLInputElement | null;

    expect(priceInput?.value).toBe("300000");
    expect(roomsInput?.value).toBe("5");
    expect(bathroomsInput?.value).toBe("2");
    expect(sizeInput?.value).toBe("187");
    expect(sizeInput?.value).not.toBe("187287");
    expect(bedroomsInput?.value).toBe("");
    expect(container.textContent || "").not.toContain("8 bedrooms");
  });

  it("prefills bookmarklet review with detected price and full description when visibleText is clipped", async () => {
    window.name = JSON.stringify(bookmarkletPriceDescriptionPayload);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(
          JSON.stringify({
            ok: true,
            campaigns: [{ id: "campaign-parser-quality", name: "Parser Quality Campaign", status: "campaign_created" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<BrowserImportReviewClient />);
    });
    await flush();

    const priceInput = container.querySelector('[data-testid="casahud-browser-import-price-input"]') as HTMLInputElement | null;
    const descriptionInput = container.querySelector('[data-testid="casahud-browser-import-description-input"]') as HTMLTextAreaElement | null;
    expect(priceInput?.value).toBe("300000");
    expect(descriptionInput?.value).toContain("privilege of living on the water");
    expect(descriptionInput?.value).not.toMatch(/privilege of\\s*$/i);
    expect(container.textContent || "").not.toContain("Price: Needs review");
  });

  it("shows actionable warnings when price is missing or description looks incomplete", async () => {
    window.name = JSON.stringify(incompleteCapturePayload);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(
          JSON.stringify({
            ok: true,
            campaigns: [{ id: "campaign-parser-quality", name: "Parser Quality Campaign", status: "campaign_created" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<BrowserImportReviewClient />);
    });
    await flush();

    const warningPanel = container.querySelector('[data-testid="casahud-browser-import-warnings"]');
    expect(warningPanel?.textContent || "").toContain("Price was not detected from the visible page. Please enter it manually.");
    expect(warningPanel?.textContent || "").toContain("Description may be incomplete. Review and paste the full listing description if needed.");
  });
});
