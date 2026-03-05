import { describe, expect, it } from "vitest";
import { scanLeakCandidates } from "@/src/directoryiq/leaks/leakScanner";

const listing = {
  nodeId: "listing-1",
  externalId: "listing-1",
  title: "Hythe Vail",
  canonicalUrl: "https://tenant.tld/hythe-vail",
  urlPaths: ["/hythe-vail"],
};

const blogBase = {
  nodeId: "blog-1",
  externalId: "blog-1",
  title: "Best Resorts",
  canonicalUrl: "https://tenant.tld/blog/best-resorts",
  html: "",
  text: "",
};

describe("leak scanner", () => {
  it("creates mention_without_link when mention exists and no link matches", () => {
    const { leaks } = scanLeakCandidates({
      blogs: [
        {
          ...blogBase,
          text: "Staying at Hythe Vail this winter was unforgettable.",
        },
      ],
      listings: [listing],
      includeOrphans: false,
    });

    expect(leaks.some((leak) => leak.leakType === "mention_without_link")).toBe(true);
  });

  it("does not create mention_without_link when href matches canonical variants", () => {
    const { leaks } = scanLeakCandidates({
      blogs: [
        {
          ...blogBase,
          html: '<p><a href="/hythe-vail/">Hythe Vail</a> is stunning.</p>',
          text: "Hythe Vail is stunning.",
        },
      ],
      listings: [listing],
      includeOrphans: false,
    });

    expect(leaks.some((leak) => leak.leakType === "mention_without_link")).toBe(false);
  });

  it("creates weak_anchor_text when anchor is click here", () => {
    const { leaks } = scanLeakCandidates({
      blogs: [
        {
          ...blogBase,
          html: '<p><a href="https://tenant.tld/hythe-vail">click here</a> for details.</p>',
          text: "click here for details",
        },
      ],
      listings: [listing],
      includeOrphans: false,
    });

    expect(leaks.some((leak) => leak.leakType === "weak_anchor_text")).toBe(true);
  });

  it("does not create weak_anchor_text for descriptive anchors", () => {
    const { leaks } = scanLeakCandidates({
      blogs: [
        {
          ...blogBase,
          html: '<p><a href="https://tenant.tld/hythe-vail">Hythe Vail resort guide</a></p>',
          text: "Hythe Vail resort guide",
        },
      ],
      listings: [listing],
      includeOrphans: false,
    });

    expect(leaks.some((leak) => leak.leakType === "weak_anchor_text")).toBe(false);
  });

  it("creates orphan_listing when no inbound links exist", () => {
    const { leaks } = scanLeakCandidates({
      blogs: [],
      listings: [listing],
      includeOrphans: true,
    });

    expect(leaks.some((leak) => leak.leakType === "orphan_listing")).toBe(true);
  });

  it("produces stable dedupe keys", () => {
    const input = {
      blogs: [
        {
          ...blogBase,
          html: '<p><a href="https://tenant.tld/hythe-vail">click here</a></p>',
          text: "click here",
        },
      ],
      listings: [listing],
      includeOrphans: false,
    };

    const first = scanLeakCandidates(input).leaks[0]?.dedupeKey;
    const second = scanLeakCandidates(input).leaks[0]?.dedupeKey;
    expect(first).toBeDefined();
    expect(first).toBe(second);
  });
});
