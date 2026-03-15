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
    expect(source).toContain("AI Visibility Score");
  });

  it("includes a collapsible See Details drawer with shorthand mapping", () => {
    expect(source).toContain("See Details");
    expect(source).toContain("data-testid=\"authority-details-toggle\"");
    expect(source).toContain("data-testid=\"authority-details-content\"");
    expect(source).toContain("node.details");
  });

  it("uses only three mission steps and opens Step 1 by default", () => {
    expect(source).toContain("Step 1 — Make Connections");
    expect(source).toContain("Step 2 — Optimize Listing");
    expect(source).toContain("Step 3 — Generate Content");
    expect(source).toContain("useState<MissionStepId>(\"make-connections\")");
    expect(source).not.toContain("Step 4:");
    expect(source).not.toContain("Step 5:");
  });

  it("shows Step 1 existing vs missing connection sections", () => {
    expect(source).toContain("data-testid=\"step1-existing-connections\"");
    expect(source).toContain("data-testid=\"step1-missing-connections\"");
    expect(source).toContain("existingConnections");
    expect(source).toContain("recommendedMissingItems");
  });

  it("shows Step 2 optimized listing package plus flywheel links subsection", () => {
    expect(source).toContain("Optimized listing package");
    expect(source).toContain("Read more about");
    expect(source).toContain("data-testid=\"step2-flywheel-links\"");
  });

  it("shows Step 3 generated content assets tied back to listing support", () => {
    expect(source).toContain("data-testid=\"step3-content-assets\"");
    expect(source).toContain("Supports listing:");
    expect(source).toContain("Generate Draft");
  });

  it("keeps publish layer persistent with required CTA set", () => {
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
