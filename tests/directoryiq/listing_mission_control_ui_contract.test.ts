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
    expect(source).toContain("data-testid=\"step2-research-entrypoint\"");
    expect(source).toContain("data-testid=\"step2-research-this-listing\"");
    expect(source).toContain("Research This Listing");
    expect(source).toContain("Start here");
    expect(source).toContain("Build the intelligence layer that makes this listing more likely to be selected by AI.");
    expect(source).toContain("STEP2_RESEARCH_REQUIRED_MESSAGE");
    expect(source).toContain("data-testid=\"step2-next-article-cta\"");
    expect(source).toContain("data-testid=\"step2-write-next-article\"");
    expect(source).toContain("data-testid={`step2-slot-locked-action-${missionSlot.slot_id}`}");
    expect(source).toContain("data-testid={`step2-slot-research-locked-${missionSlot.slot_id}`}");
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
    expect(source).toContain("Preview & Approve");
    expect(source).toContain("Approve");
    expect(source).toContain("Publish");
    expect(source).toContain("Create Ready");
    expect(source).toContain("Preview Ready");
    expect(source).toContain("Approved");
    expect(source).toContain("Needs Attention");
    expect(source).toContain("/authority/research");
    expect(source).toContain("resolveDirectoryIqJobOrInline<Step2ResearchStartResponse>");
    expect(source).not.toContain("setStep2ResearchRequestedState(\"ready\")");
  });

  it("keeps Step 2 research gating parity across hydration", () => {
    expect(source).toContain("hasUsableStep2ResearchArtifact(runtime.researchArtifact)");
    expect(source).toContain("const step2HasUsableResearch = useMemo(");
    expect(source).toContain("Object.values(step2Runtime).some");
    expect(source).not.toContain("asset.draftStatus !== \"not_started\"");
    expect(source).toContain("setServerStep2Snapshot(listingResponse.step2 ?? null);");
    expect(source).toContain("setStep2ResearchRequestedState(normalizeResearchState(listingResponse.step2.research_state));");
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
    expect(source).toContain("function firstNonEmptyValue(...values: Array<string | null | undefined>): string | null");
    expect(source).toContain("step2_contract:");
    expect(source).toContain("listing_url: firstNonEmptyValue(");
    expect(source).toContain("missionSlot.listing_url,");
    expect(source).toContain("support?.listing.canonicalUrl,");
    expect(source).toContain("listing?.listing.listing_url,");
    expect(source).toContain("displayUrl");
    expect(source).toContain("const STEP2_LISTING_URL_BLOCKER =");
    expect(source).toContain("Article generation requires a listing URL for contextual links.");
    expect(source).toContain("const resolvedListingUrlForDraft = firstNonEmptyValue(");
    expect(source).toContain("if (!resolvedListingUrlForDraft) {");
    expect(source).toContain("setError({ message: STEP2_LISTING_URL_BLOCKER });");
    expect(source).toContain("const hasListingUrlPrerequisite = Boolean(firstNonEmptyValue(contractInput.missionPlanSlot.listing_url));");
    expect(source).toContain("if (!hasListingUrlPrerequisite) {");
    expect(source).toContain("if (!step2ResearchActionReady) {");
    expect(source).toContain("setError({ message: STEP2_RESEARCH_REQUIRED_MESSAGE });");
    expect(source).toContain("const step2ResearchReady = isStep2ResearchReady(step2ResearchState);");
    expect(source).toContain("const step2ResearchActionReady = step2ResearchReady || step2ResearchState === \"ready_thin\";");
    expect(source).toContain("research_artifact: contractInput.researchArtifact");
    expect(source).toContain("deriveStep2AggregateState");
    expect(source).toContain("deriveStep2DraftAction");
    expect(source).toContain("deriveStep2PreviewPanelGate");
    expect(source).toContain("derivePublishDisabledReason");
    expect(source).toContain("deriveStep2SlotHelperMessage");
    expect(source).toContain("step2SummaryCopy");
    expect(source).toContain("aggregate_state: aggregateState");
    expect(source).toContain("const previewPanelGate = deriveStep2PreviewPanelGate({");
    expect(source).toContain("const draftAction = deriveStep2DraftAction({");
    expect(source).toContain("draft_status: asset.draftStatus,");
    expect(source).toContain("image_status: asset.imageStatus,");
    expect(source).toContain("previewPanelGate.approveVisible ? (");
    expect(source).toContain("dangerouslySetInnerHTML={{ __html: asset.draftHtml }}");
    expect(source).not.toContain("previewPanelGate.draftReady && asset.draftHtml ? asset.draftHtml : \"Draft is not ready yet.\"");
    expect(source).toContain("previewPanelGate.imageReady && asset.featuredImageUrl ? (");
    expect(source).toContain("const existingAsset = previous[item.id] ?? current;");
    expect(source).toContain("draftVersion: existingAsset.draftVersion + 1,");
    expect(source).toContain("reviewStatus: existingAsset.imageStatus === \"ready\" ? \"ready\" : \"not_ready\",");
    expect(source).toContain("imageVersion: existingAsset.imageVersion + 1,");
    expect(source).toContain("reviewStatus: existingAsset.draftStatus === \"ready\" ? \"ready\" : \"not_ready\",");
    expect(source).not.toContain("publishDisabledReason || translateStep2ErrorMessage(runtime?.errorMessage)");
    expect(source).toContain("onClick={() => void executeStep2SlotPipeline({ missionSlot, item, slot })}");
    expect(source).toContain("draftAction.kind === \"retry_draft\"");
    expect(source).toContain("draftAction.kind === \"regenerate_draft\"");
    expect(source).not.toContain("asset.draftStatus === \"failed\" ? <button");
    expect(source).not.toContain("step2_writer=1");
    expect(source).not.toContain("data-testid={`step2-slot-generate-draft-${missionSlot.slot_id}`}");
  });

  it("ensures Retry Draft path has observable failure feedback for thrown request errors", () => {
    expect(source).toContain("async function generateContentDraft(");
    expect(source).toContain("try {");
    expect(source).toContain("} catch (error) {");
    expect(source).toContain("translateStep2ErrorMessage(message, \"NETWORK_CONNECTIVITY\")");
    expect(source).toContain("draftLastErrorCode: \"NETWORK_CONNECTIVITY\"");
    expect(source).toContain("draftStatus: \"failed\"");
    expect(source).toContain("draftHtml: \"\"");
  });

  it("keeps local storage non-authoritative for step2 content assets", () => {
    expect(source).not.toContain("setContentAssets(parsed.contentAssets ?? {});");
    expect(source).not.toContain("contentAssets: Record<string, ContentAssetState>;");
  });

  it("routes retry/regenerate through the same orchestrated step2 pipeline", () => {
    expect(source).toContain("mode?: \"write_article\" | \"retry_draft\" | \"regenerate_draft\";");
    expect(source).toContain("mode: \"retry_draft\"");
    expect(source).toContain("mode: \"regenerate_draft\"");
    expect(source).not.toContain("onClick={() => void generateContentDraft(item, slot, buildStep2DraftContractInput(missionSlot))}");
  });

  it("loads preview surface from persisted server artifact path", () => {
    expect(source).toContain("async function openStep2PreviewPanel(");
    expect(source).toContain("action: \"preview\"");
    expect(source).toContain("buildDirectoryIqWriteApiUrl(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/authority/${slot}/preview`, siteQuery)");
    expect(source).toContain("draft_html");
    expect(source).toContain("featured_image_url");
  });

  it("surfaces step2 runtime parity mismatches", () => {
    expect(source).toContain("data-testid=\"step2-runtime-parity-warning\"");
    expect(source).toContain("console.warn(\"[directoryiq-step2-parity]\"");
    expect(source).toContain("if (step2ParityMismatch)");
  });

  it("keeps draft primary action ownership in slot actions, not preview panel", () => {
    const previewSurfaceStart = source.indexOf("data-testid={`step2-slot-preview-surface-${missionSlot.slot_id}`}");
    expect(previewSurfaceStart).toBeGreaterThan(-1);
    const previewSurfaceWindow = source.slice(previewSurfaceStart, previewSurfaceStart + 1800);
    expect(previewSurfaceWindow).not.toContain("draftAction.kind === \"retry_draft\"");
    expect(previewSurfaceWindow).not.toContain("draftAction.kind === \"regenerate_draft\"");
  });

  it("keeps slot presentation deterministic with numbered titles and five-slot ceiling", () => {
    expect(source).toContain("(reinforcementPlan?.items ?? []).slice(0, 5).map((item, index) => {");
    expect(source).not.toContain("(reinforcementPlan?.items ?? []).slice(0, 4)");
    expect(source).toContain("{`${slot}. ${normalizeText(item.title)}`}");
  });

  it("keeps Write Article staged without automatic publish side effects", () => {
    expect(source).toContain("async function executeStep2SlotPipeline");
    expect(source).not.toContain("await approveContentAsset(input.item, input.slot)");
    expect(source).not.toContain("await publishContentAsset(input.item, input.slot)");
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

  it("wires the failed Step 2 research retry loop into the UI", () => {
    // Retry function must exist and call the retry endpoint
    expect(source).toContain("async function retryStep2ListingResearch()");
    expect(source).toContain("/authority/research/retry");
    expect(source).toContain("data-testid=\"step2-research-retry\"");
    expect(source).toContain("Retry Research");

    // Fresh-research fallback still accessible when state is failed
    expect(source).toContain("data-testid=\"step2-research-this-listing\"");
    expect(source).toContain("Start Fresh Research");

    // Failure detail state is hydrated from the listing detail response
    expect(source).toContain("step2ResearchFailureCode");
    expect(source).toContain("step2ResearchFailureMessage");
    expect(source).toContain("research_failure_code");
    expect(source).toContain("research_failure_message");

    // Failure code should be surfaced in the UI
    expect(source).toContain("data-testid=\"step2-research-failure-code\"");

    // UI reflects failed state with rose styling
    expect(source).toContain("Research failed");
    expect(source).toContain("border-rose-300/35 bg-rose-400/10");
  });

  it("retryStep2ListingResearch maps server error codes to coherent state transitions", () => {
    // RESEARCH_IN_PROGRESS and RESEARCH_ALREADY_READY should not dead-end the UI
    expect(source).toContain("RESEARCH_IN_PROGRESS");
    expect(source).toContain("RESEARCH_ALREADY_READY");
    expect(source).toContain("NO_FAILED_RESEARCH");
    // State is reset coherently on these codes
    expect(source).toContain("errorCode === \"RESEARCH_IN_PROGRESS\"");
    expect(source).toContain("errorCode === \"RESEARCH_ALREADY_READY\"");
  });

  it("clears failure detail state on successful research hydration", () => {
    // When research state is not failed, failure detail should be cleared
    expect(source).toContain("setStep2ResearchFailureCode(null)");
    expect(source).toContain("setStep2ResearchFailureMessage(null)");
  });

  it("auto-polls listing detail when research_state is queued or researching on page load", () => {
    // Background polling effect must exist and guard against in-flight session requests
    expect(source).toContain("step2ResearchInFlightRef");
    expect(source).toContain("useRef(false)");
    expect(source).toContain("RESEARCH_POLL_INTERVAL_MS");
    expect(source).toContain("RESEARCH_POLL_MAX_MS");
    // Polling fires only when not already in-flight from this session
    expect(source).toContain("step2ResearchInFlightRef.current");
    expect(source).toContain("step2ResearchInFlightRef.current = true");
    expect(source).toContain("step2ResearchInFlightRef.current = false");
    // Polling loads listing state to pick up server transitions
    expect(source).toContain("void loadListingAndIntegrations()");
    // Polling interval guard uses correct states
    expect(source).toContain("step2ResearchRequestedState === \"queued\" || step2ResearchRequestedState === \"researching\"");
    // Polling cleans up on unmount or when state changes
    expect(source).toContain("clearInterval(intervalId)");
    // Polling has a max elapsed guard to avoid infinite polling
    expect(source).toContain("elapsed >= RESEARCH_POLL_MAX_MS");
  });

  it("auto-polls listing detail when a persisted slot draft_status is generating on page load", () => {
    // Draft polling constants must be present
    expect(source).toContain("DRAFT_POLL_INTERVAL_MS");
    expect(source).toContain("DRAFT_POLL_MAX_MS");

    // Derived boolean detects orphaned generating slots
    expect(source).toContain("hasOrphanedGeneratingDraft");
    expect(source).toContain("asset.draftStatus === \"generating\"");

    // In-flight set guards against duplicate polling
    expect(source).toContain("step2DraftInFlightSlotsRef");
    expect(source).toContain("useRef<Set<string>>(new Set())");
    expect(source).toContain("step2DraftInFlightSlotsRef.current.add(slotId)");
    expect(source).toContain("step2DraftInFlightSlotsRef.current.delete(slotId)");
    expect(source).toContain("step2DraftInFlightSlotsRef.current");

    // Polling fires loadListingAndIntegrations to pick up server transitions
    expect(source).toContain("void loadListingAndIntegrations()");

    // Polling cleans up on unmount or when condition changes
    expect(source).toContain("clearInterval(intervalId)");

    // Polling has a max elapsed guard to avoid infinite polling
    expect(source).toContain("elapsed >= DRAFT_POLL_MAX_MS");

    // try/finally ensures in-flight registration is always cleaned up
    expect(source).toContain("} finally {");
    expect(source).toContain("step2DraftInFlightSlotsRef.current.delete(slotId)");
  });
});
