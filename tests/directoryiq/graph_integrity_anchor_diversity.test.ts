import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  chooseAnchorFor,
  getCandidateAnchors,
  normalizeAnchorText,
} from "@/src/directoryiq/services/graphIntegrity/anchorDiversity";

function hashAnchor(text: string): string {
  return crypto.createHash("sha256").update(normalizeAnchorText(text)).digest("hex");
}

describe("graph integrity anchor diversity", () => {
  it("returns deterministic anchor candidates", () => {
    const anchors = getCandidateAnchors({
      listingId: "listing-1",
      title: "Acme Plumbing",
      category: "Plumbing",
      city: "Austin",
      region: "TX",
      services: ["Drain Cleaning", "Pipe Repair"],
    });

    expect(anchors).toEqual([
      "Acme Plumbing",
      "Acme Plumbing Austin TX",
      "Plumbing Austin TX",
      "Drain Cleaning Austin TX",
      "Pipe Repair Austin TX",
      "DirectoryIQ listing",
    ]);
  });

  it("avoids reusing the same anchor hash when possible", () => {
    const candidates = getCandidateAnchors({
      listingId: "listing-1",
      title: "Acme Plumbing",
      category: "Plumbing",
      city: "Austin",
      region: "TX",
      services: ["Drain Cleaning"],
    });

    const used = new Set<string>([hashAnchor(candidates[0])]);
    const result = chooseAnchorFor({
      listing: {
        listingId: "listing-1",
        title: "Acme Plumbing",
        category: "Plumbing",
        city: "Austin",
        region: "TX",
        services: ["Drain Cleaning"],
      },
      blogUrl: "https://example.com/blog/a",
      usedAnchorsLedger: used,
    });

    expect(result.anchor).not.toBe(candidates[0]);
  });
});
