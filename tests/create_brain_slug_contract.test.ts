import { describe, expect, it } from "vitest";
import { isValidBrainSlug, normalizeBrainSlug } from "@/lib/brains/createBrain";

describe("create brain slug helpers", () => {
  it("keeps canonical kebab-case slug values valid", () => {
    const normalized = normalizeBrainSlug("directoryiq-pro");
    expect(normalized).toBe("directoryiq-pro");
    expect(isValidBrainSlug(normalized)).toBe(true);
  });

  it("normalizes free-form input to safe slug format", () => {
    const normalized = normalizeBrainSlug(" DirectoryIQ Pro ");
    expect(normalized).toBe("directoryiq-pro");
    expect(isValidBrainSlug(normalized)).toBe(true);
  });

  it("treats empty normalized values as invalid", () => {
    const normalized = normalizeBrainSlug("___");
    expect(normalized).toBe("");
    expect(isValidBrainSlug(normalized)).toBe(false);
  });
});
