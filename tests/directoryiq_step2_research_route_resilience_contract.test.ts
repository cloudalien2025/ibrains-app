import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("directoryiq step2 research routes resilience contract", () => {
  it("uses shared resilience classifier instead of fatal grounded-serp hard-fail", () => {
    const researchRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/directoryiq/listings/[listingId]/authority/research/route.ts"),
      "utf8"
    );
    const retryRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/directoryiq/listings/[listingId]/authority/research/retry/route.ts"),
      "utf8"
    );

    for (const source of [researchRoute, retryRoute]) {
      expect(source.includes("classifyStep2ResearchOutcome")).toBe(true);
      expect(source.includes("outcome.state === \"failed\"")).toBe(true);
      expect(source.includes("SERP_GROUNDED_RESEARCH_REQUIRED")).toBe(false);
      expect(source.includes("hasGroundedSerpTop10")).toBe(false);
    }
  });
});
