import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientPath = path.join(
  process.cwd(),
  "app/(brains)/directoryiq/listings/[listingId]/listing-optimization-client.tsx"
);
const source = fs.readFileSync(clientPath, "utf8");

describe("listing mission control rebuild contract", () => {
  it("renders a central authority map hero node", () => {
    expect(source).toContain("data-testid=\"authority-map-canvas\"");
    expect(source).toContain("data-testid=\"listing-hero-node\"");
    expect(source).toContain("data-testid=\"listing-hero-overlay\"");
    expect(source).toContain("data-testid=\"listing-hero-title\"");
    expect(source).toContain("data-testid=\"listing-hero-score\"");
    expect(source).toContain("AI Selection Score:");
    expect(source).not.toContain("AI Visibility Score / AI Selection");
  });

  it("includes a collapsible See Details drawer with shorthand mapping", () => {
    expect(source).toContain("See Details");
    expect(source).toContain("data-testid=\"authority-details-toggle\"");
    expect(source).toContain("data-testid=\"authority-details-content\"");
    expect(source).toContain("node.details");
  });

  it("uses only three mission steps and opens Step 1 by default", () => {
    expect(source).toContain("MISSION_CONTROL_STEPS");
    expect(source).toContain("missionStepContract(\"find-support\")");
    expect(source).toContain("missionStepContract(\"optimize-listing\")");
    expect(source).toContain("activeStepId === \"create-support\"");
    expect(source).toContain("useState<MissionStepId>(\"find-support\")");
    expect(source).not.toContain("Step 4:");
    expect(source).not.toContain("Step 5:");
  });

  it("shows Step 1 real assets and derived recommendation sections", () => {
    expect(source).toContain("data-testid=\"step1-real-existing-connections\"");
    expect(source).toContain("data-testid=\"step1-real-mentions-without-links\"");
    expect(source).toContain("data-testid=\"step1-derived-recommendations\"");
    expect(source).toContain("data-testid=\"step1-recommendation-plan-checkbox\"");
    expect(source).toContain("Add to Mission Plan");
    expect(source).toContain("In Mission Plan");
    expect(source).not.toContain("Mark Ready");
    expect(source).not.toContain("Queue for Publish");
    expect(source).toContain("data-testid=\"step1-missing-connections\"");
    expect(source).toContain("Mission plan is a selection state only. Publishing is handled in Steps 2 and 3.");
    expect(source).not.toContain("data-testid=\"step1-slot-run-");
    expect(source).toContain("derivedRecommendationGroups");
    expect(source).toContain("recommendedMissingItems");
  });

  it("shows Step 3 optimized listing package plus flywheel links subsection", () => {
    expect(source).toContain("Optimized listing package");
    expect(source).toContain("Read more about");
    expect(source).toContain("data-testid=\"step2-flywheel-links\"");
    expect(source).toContain("data-testid=\"step3-locked-state\"");
    expect(source).toContain("STEP3_UNLOCK_CONTRACT.lockBody");
    expect(source).toContain("requiredValidSupportCount");
  });

  it("shows Step 2 generated content assets tied back to listing support", () => {
    expect(source).toContain("data-testid=\"step2-slot-list\"");
    expect(source).toContain("data-testid=\"step2-progress-summary\"");
    expect(source).toContain("data-testid=\"step2-next-article-cta\"");
    expect(source).toContain("data-testid=\"step2-write-next-article\"");
    expect(source).toContain("data-testid={`step2-slot-status-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid={`step2-slot-actions-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid={`step2-slot-primary-action-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid={`step2-slot-openai-setup-cta-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid={`step2-slot-secondary-action-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid=\"step2-openai-setup-cta\"");
    expect(source).toContain("OpenAI is not configured for this site.");
    expect(source).toContain("Connect it in DirectoryIQ > Signal Sources to generate support articles.");
    expect(source).toContain("Build Support Articles");
    expect(source).toContain("Create the articles that help AI engines understand and recommend this listing.");
    expect(source).not.toContain("Run Slot Pipeline");
    expect(source).not.toContain("Confirm Valid Slot");
    expect(source).not.toContain("Generate Draft");
    expect(source).not.toContain(">Approve<");
    expect(source).not.toContain("onClick={() => void publishContentAsset(item, slot)}");
  });

  it("keeps publish layer scoped to Step 2 with required CTA set", () => {
    expect(source).toContain("{activeStepId === \"create-support\" ? (");
    expect(source).toContain("data-testid=\"publish-execution-layer\"");
    expect(source).toContain("Publish All Approved Assets");
    expect(source).toContain("Preview Changes");
    expect(source).toContain("Publish Selected");
    expect(source).toContain("Save as Draft");
  });

  it("applies publish success state transitions and score refresh path", () => {
    expect(source).toContain("setListingLifecycle(\"Published\")");
    expect(source).toContain("status: \"Published\"");
    expect(source).toContain("computedScore");
    expect(source).toContain("loadListingAndIntegrations()");
  });

  it("routes Step 2 pipeline draft generation through contract input with strict gating", () => {
    expect(source).toContain("function buildStep2DraftContractInput(missionSlot: Step2MissionPlanSlot): Step2DraftContractInput");
    expect(source).toContain("step2_contract:");
    expect(source).toContain("listing_url: listingUrl ?? support?.listing.canonicalUrl ?? null");
    expect(source).toContain("research_artifact: contractInput.researchArtifact");
    expect(source).toContain("deriveStep2PrimaryAction(actionInput)");
    expect(source).toContain("deriveStep2StatusLabel(actionInput)");
    expect(source).toContain("deriveStep2SectionCta");
    expect(source).toContain("shouldAllowStep2PipelineRun(actionInput)");
    expect(source).toContain("summarizeStep2StatusBuckets");
    expect(source).toContain("onClick={() => void executeStep2SlotPipeline({ missionSlot, item, slot })}");
    expect(source).not.toContain("step2_writer=1");
    expect(source).not.toContain("data-testid={`step2-slot-generate-draft-${missionSlot.slot_id}`}");
  });

  it("avoids sticky overlap and vertical nav bloat regressions", () => {
    expect(source).not.toContain("sticky top-");
    expect(source).not.toContain("sticky bottom-");
    expect(source).not.toContain("listing-step-nav-desktop-launch-and-measure");
  });

  it("keeps mobile interactions non-obstructive", () => {
    expect(source).not.toContain("fixed inset-0");
    expect(source).not.toContain("z-40");
    expect(source).toContain("grid gap-2 sm:grid-cols-3");
  });
});
