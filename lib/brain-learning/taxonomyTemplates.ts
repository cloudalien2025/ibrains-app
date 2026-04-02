export type TaxonomyTemplateNode = {
  key: string;
  label: string;
  description?: string;
  parentKey?: string;
  keywords?: string[];
};

export type TaxonomyTemplateDefinition = {
  key: string;
  label: string;
  nodes: TaxonomyTemplateNode[];
};

const sharedNodes: TaxonomyTemplateNode[] = [
  {
    key: "domain.knowledge",
    label: "Domain Knowledge",
    description: "Top-level domain expertise and terminology.",
    keywords: ["domain", "concept", "framework", "model"],
  },
  {
    key: "operations.execution",
    label: "Operations & Execution",
    description: "Operational workflows, procedures, and execution details.",
    keywords: ["workflow", "process", "runbook", "execution", "operation"],
  },
  {
    key: "metrics.performance",
    label: "Metrics & Performance",
    description: "Performance indicators, KPIs, and benchmark outcomes.",
    keywords: ["kpi", "metric", "benchmark", "performance", "growth", "conversion"],
  },
  {
    key: "strategy.planning",
    label: "Strategy & Planning",
    description: "Strategic analysis and roadmap guidance.",
    keywords: ["strategy", "plan", "roadmap", "prioritize", "positioning"],
  },
];

const directoryIqNodes: TaxonomyTemplateNode[] = [
  {
    key: "directoryiq.local-seo",
    label: "Local SEO",
    description: "Ranking and visibility tactics for local business search.",
    parentKey: "domain.knowledge",
    keywords: ["google business profile", "local pack", "citation", "map ranking", "gbp"],
  },
  {
    key: "directoryiq.listing-operations",
    label: "Listing Operations",
    description: "Claiming, updating, syncing, and fixing business listings.",
    parentKey: "operations.execution",
    keywords: ["listing", "nap", "duplicate listing", "suppression", "sync"],
  },
  {
    key: "directoryiq.reputation",
    label: "Reviews & Reputation",
    description: "Reviews, ratings, response playbooks, and reputation workflows.",
    parentKey: "metrics.performance",
    keywords: ["review", "rating", "sentiment", "reputation", "response rate"],
  },
];

const ecomViperNodes: TaxonomyTemplateNode[] = [
  {
    key: "ecomviper.catalog",
    label: "Catalog Intelligence",
    description: "Product feed quality, taxonomy, and catalog structure.",
    parentKey: "domain.knowledge",
    keywords: ["catalog", "sku", "feed", "attribute", "taxonomy", "merchandising"],
  },
  {
    key: "ecomviper.acquisition",
    label: "Acquisition Channels",
    description: "Paid and organic channel mechanics for traffic acquisition.",
    parentKey: "strategy.planning",
    keywords: ["cpc", "roas", "campaign", "creative", "audience", "attribution"],
  },
  {
    key: "ecomviper.conversion",
    label: "Conversion Optimization",
    description: "On-site conversion levers and checkout optimization.",
    parentKey: "metrics.performance",
    keywords: ["conversion rate", "checkout", "aov", "funnel", "landing page"],
  },
];

export const taxonomyTemplates: Record<string, TaxonomyTemplateDefinition> = {
  foundational: {
    key: "foundational",
    label: "Foundational",
    nodes: sharedNodes,
  },
  directoryiq_foundational: {
    key: "directoryiq_foundational",
    label: "DirectoryIQ Foundational",
    nodes: [...sharedNodes, ...directoryIqNodes],
  },
  ecomviper_foundational: {
    key: "ecomviper_foundational",
    label: "EcomViper Foundational",
    nodes: [...sharedNodes, ...ecomViperNodes],
  },
};

export function getTaxonomyTemplate(templateKey?: string | null): TaxonomyTemplateDefinition {
  const key = (templateKey || "foundational").trim();
  return taxonomyTemplates[key] || taxonomyTemplates.foundational;
}
