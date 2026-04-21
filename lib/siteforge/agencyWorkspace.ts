export const agencyStatuses = [
  "Not started",
  "Researching",
  "Drafting",
  "Recommended",
  "Awaiting approval",
  "Approved",
  "Building",
  "Built",
  "Needs revision",
  "Blocked",
] as const;

export type AgencyStatus = (typeof agencyStatuses)[number];

export const confidenceLevels = ["Low", "Medium", "High", "Verified"] as const;

export type ConfidenceLevel = (typeof confidenceLevels)[number];

export type AgentRosterEntry = {
  id: string;
  displayName: string;
  specialty: string;
  mission: string;
  currentTask: string;
  status: AgencyStatus;
  confidence: ConfidenceLevel;
  ownedObjects: string[];
  outputs: string[];
  blockers: string[];
};

export type ApprovalLevel = "Directional approval" | "Structural approval" | "Content approval" | "Build approval";

export type ApprovalItem = {
  id: string;
  level: ApprovalLevel;
  itemName: string;
  ownerAgentId: string;
  changeSummary: string;
  confidence: ConfidenceLevel;
  affectedPages: string[];
  preview: string;
  status: AgencyStatus;
};

export type AgencyWorkstream = {
  id: string;
  name: "Positioning" | "Site Shell" | "Homepage" | "Lead Funnel" | "Blog Engine" | "Conversion System";
  ownerAgentId: string;
  progress: number;
  nextMilestone: string;
  blockerState: string;
  status: AgencyStatus;
  confidence: ConfidenceLevel;
};

export type AgencyDeliverable = {
  id: string;
  title: string;
  ownerAgentId: string;
  status: AgencyStatus;
  confidence: ConfidenceLevel;
  timestamp: string;
};

export type ReusableAssetType =
  | "Header"
  | "Footer"
  | "Reusable Block"
  | "Section Asset"
  | "Shell Template"
  | "Layout System"
  | "CTA Block"
  | "FAQ"
  | "Testimonial";

export type ReusableAsset = {
  id: string;
  name: string;
  type: ReusableAssetType;
  category: string;
  usageCount: number;
  source: string;
  status: AgencyStatus;
  compatiblePageTypes: string[];
  fingerprint: string | null;
  matchConfidence: number | null;
};

export type ExperimentIdea = {
  id: string;
  variantName: string;
  rationale: string;
  expectedGain: string;
  confidence: ConfidenceLevel;
  affectedPages: string[];
  status: AgencyStatus;
};

export type PublishChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  ownerAgentId: string;
};

export function createDefaultAgentRoster(): AgentRosterEntry[] {
  return [
    {
      id: "strategy-director",
      displayName: "Strategy Director",
      specialty: "Positioning + offer direction",
      mission: "Drive strategic clarity and approve positioning direction.",
      currentTask: "Finalize market-aware value proposition",
      status: "Awaiting approval",
      confidence: "High",
      ownedObjects: ["Business Brief", "Positioning", "Sitemap Recommendation"],
      outputs: ["Direction memo", "Positioning options"],
      blockers: [],
    },
    {
      id: "brand-director",
      displayName: "Brand Director",
      specialty: "Brand identity + design rules",
      mission: "Keep visual and tone consistency across every page.",
      currentTask: "Validate design tokens against Thrive skin",
      status: "Drafting",
      confidence: "Medium",
      ownedObjects: ["Brand Identity", "Design Tokens", "Brand Rules"],
      outputs: ["Brand token set", "Voice guardrails"],
      blockers: [],
    },
    {
      id: "theme-shell-architect",
      displayName: "Theme Shell Architect",
      specialty: "Shell template and layout mapping",
      mission: "Align shell and layout systems to funnel intent.",
      currentTask: "Recommend shell template for homepage and lead pages",
      status: "Recommended",
      confidence: "High",
      ownedObjects: ["Shell Template", "Layout System"],
      outputs: ["Shell recommendation", "Layout mapping"],
      blockers: [],
    },
    {
      id: "content-architect",
      displayName: "Content Architect",
      specialty: "Information architecture",
      mission: "Turn strategy into page structures and section stacks.",
      currentTask: "Define homepage section stack",
      status: "Drafting",
      confidence: "High",
      ownedObjects: ["Page Briefs", "Section Navigator", "Sitemap"],
      outputs: ["Page structure briefs"],
      blockers: [],
    },
    {
      id: "copy-chief",
      displayName: "Copy Chief",
      specialty: "Conversion copy",
      mission: "Produce concise, high-conversion copy with clear claims.",
      currentTask: "Refine hero and CTA copy variants",
      status: "Researching",
      confidence: "Medium",
      ownedObjects: ["Copy Layer", "CTA Stack", "FAQs"],
      outputs: ["Approved headlines", "CTA variants"],
      blockers: [],
    },
    {
      id: "thrive-asset-librarian",
      displayName: "Thrive Asset Librarian",
      specialty: "Reusable asset matching",
      mission: "Match section needs to safe reusable Thrive assets.",
      currentTask: "Match symbols and section assets by fingerprint",
      status: "Recommended",
      confidence: "Verified",
      ownedObjects: ["Reusable Blocks", "Section Assets", "Manifest"],
      outputs: ["Asset recommendations", "Compatibility matrix"],
      blockers: [],
    },
    {
      id: "builder-operations-agent",
      displayName: "Builder Operations Agent",
      specialty: "Build orchestration",
      mission: "Prepare pages for build without unsafe Thrive writes.",
      currentTask: "Confirm build readiness and dependency completeness",
      status: "Awaiting approval",
      confidence: "High",
      ownedObjects: ["Build Readiness", "Dependencies", "Linked Funnel Steps"],
      outputs: ["Build package", "Readiness notes"],
      blockers: [],
    },
    {
      id: "cro-analyst",
      displayName: "CRO Analyst",
      specialty: "Experiments + optimization",
      mission: "Find conversion opportunities and prioritize experiments.",
      currentTask: "Prioritize homepage headline and CTA experiments",
      status: "Researching",
      confidence: "Medium",
      ownedObjects: ["Experiment Queue", "Evidence Panel"],
      outputs: ["Experiment rationale", "Expected gain forecast"],
      blockers: [],
    },
    {
      id: "qa-publish-agent",
      displayName: "QA / Publish Agent",
      specialty: "Readiness and release",
      mission: "Gate publish with checklist, audit trail, and risks.",
      currentTask: "Validate publish checklist and legal coverage",
      status: "Drafting",
      confidence: "High",
      ownedObjects: ["Publish Checklist", "Audit Log", "Risk Register"],
      outputs: ["Release recommendation", "QA findings"],
      blockers: [],
    },
  ];
}
