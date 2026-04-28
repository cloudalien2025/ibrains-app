type CasaHudMarketProfile = {
  marketLabel: string;
  searchQuery: string;
  roundupRegion: string;
  lifestyleRegion: string;
  nicheRegion: string;
  locationCity: string;
  showcaseLocation: string;
  showcaseProperty: string;
  showcaseDescriptor: string;
  showcaseHook: string;
  buyerPersona: string;
  budgetLabel: string;
  roundupCount: number;
  comparisonBenchmark: string;
  nichePropertyPlural: string;
  searchHints: string[];
  opportunityCategories: string[];
  audienceIntent: string[];
  suggestedDirections: string[];
  riskNotes: string[];
};

const DEFAULT_PREFERRED_MARKET = "Italian real-estate YouTube";

const MARKET_PROFILES: Array<{ matchers: RegExp[]; profile: CasaHudMarketProfile }> = [
  {
    matchers: [/portugal|algarve|lisbon/i],
    profile: {
      marketLabel: "Portugal relocation and property YouTube",
      searchQuery: "Portugal real estate relocation homes YouTube",
      roundupRegion: "the Algarve",
      lifestyleRegion: "the Algarve",
      nicheRegion: "Central Portugal",
      locationCity: "Lisbon",
      showcaseLocation: "Comporta",
      showcaseProperty: "villa",
      showcaseDescriptor: "coastal design-led",
      showcaseHook: "resort-style outdoor living",
      buyerPersona: "international relocation buyers",
      budgetLabel: "€450K",
      roundupCount: 6,
      comparisonBenchmark: "starter home in Austin",
      nichePropertyPlural: "quinta homes",
      searchHints: ["Portugal homes under 450k", "Algarve relocation homes", "Lisbon commuter villages"],
      opportunityCategories: ["retirement relocation", "coastal value", "commuter lifestyle"],
      audienceIntent: ["cost-of-living comparison", "move-to-Portugal planning", "walkable coastal homes"],
      suggestedDirections: [
        "Budget-led Algarve roundups",
        "Retirement question hooks",
        "Lisbon commuter-belt location videos",
      ],
      riskNotes: [
        "Golden visa language can date quickly and should not lead the promise.",
        "Over-claiming Lisbon affordability makes later listing validation harder.",
      ],
    },
  },
  {
    matchers: [/spain|valencia|andalusia|andalucia|alicante/i],
    profile: {
      marketLabel: "Spain coastal property YouTube",
      searchQuery: "Spain real estate coastal homes relocation YouTube",
      roundupRegion: "Southern Spain",
      lifestyleRegion: "Valencia",
      nicheRegion: "Andalusia",
      locationCity: "Valencia",
      showcaseLocation: "Marbella",
      showcaseProperty: "villa",
      showcaseDescriptor: "sunlit contemporary",
      showcaseHook: "sea-view terraces",
      buyerPersona: "American lifestyle buyers",
      budgetLabel: "€500K",
      roundupCount: 7,
      comparisonBenchmark: "Florida condo",
      nichePropertyPlural: "townhouses",
      searchHints: ["Spain homes under 500k", "Valencia homes for Americans", "Andalusia townhouses"],
      opportunityCategories: ["coastal affordability", "lifestyle relocation", "city-access homes"],
      audienceIntent: ["warm-weather move", "Mediterranean second home", "city versus coast tradeoffs"],
      suggestedDirections: [
        "Specific coast-plus-budget titles",
        "American buyer framing near Valencia",
        "Region-led townhouse niches",
      ],
      riskNotes: [
        "Broad Spain claims are harder to support than region-led videos.",
        "Single-property luxury titles reduce repeatability compared with roundups.",
      ],
    },
  },
  {
    matchers: [/greece|crete|athens|peloponnese/i],
    profile: {
      marketLabel: "Greece relocation and island home YouTube",
      searchQuery: "Greece real estate island homes relocation YouTube",
      roundupRegion: "Crete",
      lifestyleRegion: "Greece",
      nicheRegion: "the Peloponnese",
      locationCity: "Athens",
      showcaseLocation: "Paros",
      showcaseProperty: "stone house",
      showcaseDescriptor: "Cycladic modern",
      showcaseHook: "Aegean sunset views",
      buyerPersona: "retirees and second-home buyers",
      budgetLabel: "€350K",
      roundupCount: 5,
      comparisonBenchmark: "small apartment in Boston",
      nichePropertyPlural: "stone homes",
      searchHints: ["Crete homes under 350k", "Greece retire in Europe", "Peloponnese stone homes"],
      opportunityCategories: ["island affordability", "retirement relocation", "lifestyle-led regional picks"],
      audienceIntent: ["retire in Greece", "island life tradeoffs", "buyable Mediterranean homes"],
      suggestedDirections: [
        "Island affordability roundups",
        "Retirement-question titles with budgets",
        "Niche stone-home regional lists",
      ],
      riskNotes: [
        "Island inventory can be seasonal, so overly broad availability claims are risky.",
        "Athens-led titles need clearer buyer intent than generic city tours.",
      ],
    },
  },
  {
    matchers: [/tuscany|florence|lake como|abruzzo|southern italy|italy|italian/i],
    profile: {
      marketLabel: "Italy relocation and property YouTube",
      searchQuery: "Italy real estate affordable homes relocation YouTube",
      roundupRegion: "Southern Italy",
      lifestyleRegion: "Southern Italy",
      nicheRegion: "Tuscany",
      locationCity: "Florence",
      showcaseLocation: "Lake Como",
      showcaseProperty: "villa",
      showcaseDescriptor: "modern",
      showcaseHook: "stunning lake views",
      buyerPersona: "American buyers",
      budgetLabel: "$300K",
      roundupCount: 7,
      comparisonBenchmark: "Florida condo",
      nichePropertyPlural: "farmhouses",
      searchHints: ["Southern Italy homes under 300k", "Tuscany farmhouses under 1M", "homes near Florence"],
      opportunityCategories: ["affordable coastal roundups", "retirement relocation", "regional niche inventory"],
      audienceIntent: ["buyable Italy homes", "retire in Italy", "American buyer location guidance"],
      suggestedDirections: [
        "Southern Italy affordability roundups",
        "Question-led relocation titles",
        "Tuscany farmhouse niche videos",
        "Florence-adjacent location videos",
      ],
      riskNotes: [
        "Very cheap Italy claims can become hard to prove with current listings.",
        "Single trophy-home titles are less repeatable than regional or category concepts.",
      ],
    },
  },
];

export function getDefaultPreferredMarket(): string {
  return DEFAULT_PREFERRED_MARKET;
}

export function resolveCasaHudMarketProfile(preferredMarket?: string): CasaHudMarketProfile {
  const input = preferredMarket?.trim() || DEFAULT_PREFERRED_MARKET;
  const matched = MARKET_PROFILES.find((entry) => entry.matchers.some((matcher) => matcher.test(input)));
  return matched?.profile || MARKET_PROFILES.at(-1)!.profile;
}
