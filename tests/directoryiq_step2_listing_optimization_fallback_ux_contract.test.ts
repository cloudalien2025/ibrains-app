import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq step2 listing optimization fallback UX contract", () => {
  it("unlocks create flow for safe ready_thin and renders state-aware messaging", () => {
    const filePath = path.join(
      process.cwd(),
      "app/apps/directoryiq/listings/[listingId]/listing-optimization-client.tsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("canCreateStep2FromResearch(step2ResearchState)")).toBe(true);
    expect(source.includes("label: \"Research fallback\"")).toBe(true);
    expect(source.includes("deriveStep2ThinResearchMessage(step2ThinResearchReason)")).toBe(true);
    expect(source.includes("deriveStep2ResearchFailureMessage({")).toBe(true);
    expect(source.includes("step2ResearchState === \"not_started\" || step2ResearchState === \"failed\"")).toBe(true);
  });
});
