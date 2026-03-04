import { test } from "vitest";
import assert from "node:assert/strict";
import { buildConsensusOutline } from "../../lib/directoryiq/serp/consensus";

test("consensus outline ordering and length band are deterministic", () => {
  const outlines = Array.from({ length: 10 }).map((_, idx) => ({
    url: `https://example.com/${idx}`,
    pageTitle: `Page ${idx}`,
    h1: "Roof Repair",
    h2: ["Cost Factors", "How to Choose a Contractor", "FAQ"],
    h3: ["What is included?"],
    wordCount: 900 + idx * 100,
  }));

  const result = buildConsensusOutline(outlines);
  assert.equal(result.h2Sections[0]?.heading, "Cost Factors");
  assert.deepEqual(result.targetLengthBand, { min: 1000, median: 1350, max: 1700 });
});
