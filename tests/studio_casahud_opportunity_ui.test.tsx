// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioDomaraClient from "@/app/apps/studio/studio-domara-client";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

const successOutput: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaHUD identified the strongest opportunity in regional affordability plus relocation intent.",
    opportunityCategories: ["affordable coastal roundups", "retirement relocation", "regional niche inventory"],
    competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
    audienceIntent: ["buyable Italy homes", "retire in Italy"],
    suggestedTitleDirections: ["Southern Italy affordability roundups", "Question-led relocation titles"],
    riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
  },
  titleCandidates: [
    {
      id: "title-1",
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      ctrPotential: 93,
      searchAppeal: 90,
      novelty: 82,
      realism: 91,
      listingAvailability: 88,
      channelFit: 90,
      titleTruthfulness: 92,
      campaignType: "lifestyle_relocation",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
      reasoning: "Strong relocation intent plus a concrete budget makes this highly clickable and supportable.",
    },
    {
      id: "title-2",
      title: "7 Affordable Beachfront Homes in Southern Italy",
      score: 90,
      ctrPotential: 91,
      searchAppeal: 88,
      novelty: 79,
      realism: 89,
      listingAvailability: 90,
      channelFit: 89,
      titleTruthfulness: 91,
      campaignType: "roundup",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy beachfront homes"],
      reasoning: "This roundup stays highly repeatable and keeps the geography clear.",
    },
    {
      id: "title-3",
      title: "Best Tuscany Farmhouses Under €1M",
      score: 86,
      ctrPotential: 84,
      searchAppeal: 87,
      novelty: 77,
      realism: 88,
      listingAvailability: 84,
      channelFit: 86,
      titleTruthfulness: 89,
      campaignType: "niche_category",
      regionHint: "Tuscany",
      listingSearchHints: ["Tuscany farmhouses under 1M"],
      reasoning: "The niche is strong, but the relocation hook above is broader and more viral.",
    },
  ],
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.89,
    reasoning: "CasaHUD chose this title because it balances click potential with a believable promise.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "Could You Retire in Southern Italy for Under $300K? rose to the top because it gives CasaHUD a clear, searchable concept that can still hold up when listing discovery begins.",
  confidenceSummary:
    "89% confidence. CasaHUD prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaHUD opportunity patterns",
    detail: "Using CasaHUD opportunity patterns until YouTube connection is enabled for live competitive research.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Phase 3 will turn this winning concept into a saved CasaHUD campaign with durable workflow state.",
  },
};

const savedCampaign: CasaHudCampaign = {
  id: "casahud-project-phase3",
  name: "Could You Retire in Southern Italy for Under $300K?",
  selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
  selectedTitle: successOutput.selectedTitle,
  titleCandidates: successOutput.titleCandidates,
  researchBrief: successOutput.researchBrief,
  campaignType: successOutput.campaignTypePrediction,
  marketRegionHint: "Southern Italy",
  preferredMarket: successOutput.preferredMarket,
  generationSource: successOutput.providerStatus,
  confidenceReasoning: {
    summary: successOutput.confidenceSummary,
    titleOpportunitySummary: successOutput.titleOpportunitySummary,
    selectedTitleReasoning: successOutput.selectedTitle.reasoning,
    selectedTitleConfidence: successOutput.selectedTitle.confidence,
  },
  status: "campaign_created",
  nextPhase: {
    key: "property_discovery",
    label: "Find matching properties",
    detail: "Property Discovery arrives next. CasaHUD will enrich this campaign without regenerating the title package.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:10:00.000Z",
  generatedAt: successOutput.generatedAt,
  futureState: {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    locationIntelligence: null,
    mapPoiBundle: null,
    script: null,
    storyboard: null,
    mediaPlan: null,
    packaging: null,
    renderStatus: null,
    reviewStatus: null,
    publishStatus: null,
    scheduleStatus: null,
  },
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaHUD opportunity UI flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clicking Generate Viral Video Title shows the Phase 2 result state with a winning title and ranked candidates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const button = container.querySelector('[data-testid="casahud-generate-cta"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')?.textContent).toContain(
      successOutput.selectedTitle.title,
    );
    expect(container.querySelectorAll('[data-testid="casahud-candidate-card"]').length).toBe(3);
    expect(container.textContent).toContain("Researching YouTube opportunities");
    expect(container.textContent).toContain("Why this title was chosen");
    expect(container.textContent).toContain("Create Campaign");
    expect(container.querySelector('[data-testid="casahud-create-campaign-cta"]')?.textContent).toContain("Create Campaign");
    expect(container.textContent).toContain(`Campaign name: ${successOutput.selectedTitle.title}`);
  });

  it("creates a saved campaign, shows it in Recent Campaigns, and reopens it without regenerating titles", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: savedCampaign,
            summary: {
              id: savedCampaign.id,
              name: savedCampaign.name,
              campaignType: savedCampaign.campaignType,
              marketRegionHint: savedCampaign.marketRegionHint,
              status: savedCampaign.status,
              createdAt: savedCampaign.createdAt,
              updatedAt: savedCampaign.updatedAt,
              researchSummary: savedCampaign.researchBrief.summary,
            },
            message: `Campaign saved. "${savedCampaign.name}" is ready for Property Discovery.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: savedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const generateButton = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const createButton = container.querySelector('[data-testid="casahud-create-campaign-cta"]');
    expect(createButton).not.toBeNull();

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-detail"]')?.textContent).toContain(savedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-campaign-create-success"]')?.textContent).toContain(
      "ready for Property Discovery",
    );
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain(savedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain("Resume");
    expect(container.textContent).toContain("Next: Find matching properties");

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    expect(resumeButton).not.toBeNull();
    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-detail"]')?.textContent).toContain(
      savedCampaign.selectedViralTitle,
    );
    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')).toBeNull();
  });

  it("shows a safe recoverable error if campaign creation fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "POST") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "CasaHUD could not save this campaign right now. Try again in a moment." },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const generateButton = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const createButton = container.querySelector('[data-testid="casahud-create-campaign-cta"]');
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-create-error"]')?.textContent).toContain(
      "CasaHUD could not save this campaign right now. Try again in a moment.",
    );
  });

  it("shows a safe recoverable error if the opportunity route fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/opportunity")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "CasaHUD could not generate title opportunities right now. Try again in a moment." },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const button = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-generation-error"]')?.textContent).toContain(
      "CasaHUD could not generate title opportunities right now. Try again in a moment.",
    );
    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')).toBeNull();
  });
});
