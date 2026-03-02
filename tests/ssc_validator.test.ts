import { describe, expect, it } from "vitest";
import { validateSscResponse, SscValidationError } from "../app/api/ssc/_utils/validator";

const base = {
  dimension: "DB_indexability_crawlability",
  score: 10,
  reasons: [
    { title: "Reason 1", explanation: "Short explanation.", quote: null },
    { title: "Reason 2", explanation: "Short explanation.", quote: null },
    { title: "Reason 3", explanation: "Short explanation.", quote: null },
  ],
  flags: [],
};

describe("SSC validator", () => {
  it("accepts valid payload", () => {
    const json = JSON.stringify(base);
    const result = validateSscResponse(json, {
      dimension: base.dimension,
      sourceText: "Sample snapshot text",
      flagsVocabulary: [],
    });
    expect(result.score).toBe(10);
  });

  it("rejects non-json", () => {
    expect(() =>
      validateSscResponse("not json", {
        dimension: base.dimension,
        sourceText: "",
        flagsVocabulary: [],
      })
    ).toThrow(SscValidationError);
  });

  it("rejects extra keys", () => {
    const json = JSON.stringify({ ...base, extra: true });
    expect(() =>
      validateSscResponse(json, {
        dimension: base.dimension,
        sourceText: "",
        flagsVocabulary: [],
      })
    ).toThrow(SscValidationError);
  });

  it("enforces reasons count", () => {
    const json = JSON.stringify({ ...base, reasons: [] });
    expect(() =>
      validateSscResponse(json, {
        dimension: base.dimension,
        sourceText: "",
        flagsVocabulary: [],
      })
    ).toThrow(SscValidationError);
  });

  it("enforces quote word limit", () => {
    const json = JSON.stringify({
      ...base,
      reasons: [
        {
          title: "Reason",
          explanation: "Short explanation.",
          quote: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty one two three four five six",
        },
        base.reasons[1],
        base.reasons[2],
      ],
    });
    expect(() =>
      validateSscResponse(json, {
        dimension: base.dimension,
        sourceText: "",
        flagsVocabulary: [],
      })
    ).toThrow(SscValidationError);
  });

  it("enforces quote substring", () => {
    const json = JSON.stringify({
      ...base,
      reasons: [
        { title: "Reason", explanation: "Short explanation.", quote: "Missing quote" },
        base.reasons[1],
        base.reasons[2],
      ],
    });
    expect(() =>
      validateSscResponse(json, {
        dimension: base.dimension,
        sourceText: "Snapshot contains different text",
        flagsVocabulary: [],
      })
    ).toThrow(SscValidationError);
  });

  it("enforces flags vocabulary", () => {
    const json = JSON.stringify({
      ...base,
      flags: ["not_allowed"],
    });
    expect(() =>
      validateSscResponse(json, {
        dimension: base.dimension,
        sourceText: "",
        flagsVocabulary: ["allowed"],
      })
    ).toThrow(SscValidationError);
  });
});
