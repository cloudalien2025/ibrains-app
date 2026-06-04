import { describe, expect, it } from "vitest";
import { safeIsoDate, safeMoney } from "@/lib/ui/safe-formatters";

describe("ui safe formatters", () => {
  it("returns fallback for null/invalid dates", () => {
    expect(safeIsoDate(null, "Never")).toBe("Never");
    expect(safeIsoDate(undefined, "Never")).toBe("Never");
    expect(safeIsoDate("not-a-date", "Never")).toBe("Never");
  });

  it("returns ISO string for valid date values", () => {
    expect(safeIsoDate("2026-05-30T12:00:00.000Z", "Never")).toBe("2026-05-30T12:00:00.000Z");
  });

  it("returns fallback for null/invalid money values", () => {
    expect(safeMoney(null, { fallback: "Unknown" })).toBe("Unknown");
    expect(safeMoney(undefined, { fallback: "Unknown" })).toBe("Unknown");
    expect(safeMoney(Number.NaN, { fallback: "Unknown" })).toBe("Unknown");
  });

  it("formats valid money values", () => {
    expect(safeMoney(12.5, { currency: "USD" })).toBe("$12.50");
  });
});
