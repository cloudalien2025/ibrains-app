import { describe, expect, it } from "vitest";
import { normalizeSlot } from "@/app/api/directoryiq/_utils/authority";

describe("directoryiq authority slot validation contract", () => {
  it("accepts slot values in the canonical range", () => {
    expect(normalizeSlot("1")).toBe(1);
    expect(normalizeSlot("5")).toBe(5);
  });

  it("rejects out-of-range slot values", () => {
    expect(() => normalizeSlot("0")).toThrow("between 1 and 5");
    expect(() => normalizeSlot("6")).toThrow("between 1 and 5");
  });
});
