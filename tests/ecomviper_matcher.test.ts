import { describe, expect, it } from "vitest";
import { scoreProductToArticle } from "../app/api/ecomviper/_utils/matcher";

describe("deterministic product/article scorer", () => {
  it("scores higher for handle + tag + keyword overlap", () => {
    const strong = scoreProductToArticle(
      {
        handle: "opa-coq10-200mg",
        title: "OPA CoQ10 200mg",
        tags: ["Heart Health", "Energy"],
      },
      {
        title: "Why OPA CoQ10 Helps Heart Health and Daily Energy",
        tags: ["heart health", "energy"],
        bodyText: "This article references opa-coq10-200mg and ubiquinone support.",
      }
    );

    const weak = scoreProductToArticle(
      {
        handle: "opa-coq10-200mg",
        title: "OPA CoQ10 200mg",
        tags: ["Heart Health", "Energy"],
      },
      {
        title: "Baking bread for beginners",
        tags: ["kitchen"],
        bodyText: "No supplement context.",
      }
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reason).toContain("tag_overlap");
  });
});
