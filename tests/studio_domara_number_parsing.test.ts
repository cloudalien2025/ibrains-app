import { describe, expect, it } from "vitest";
import { parseLocalizedNumber, parseRealEstatePrice } from "@/lib/studio/domara/number-parsing";

describe("CasaFlix number parsing", () => {
  it("parses real-estate price strings with locale thousands separators", () => {
    expect(parseRealEstatePrice("260,000")).toBe(260000);
    expect(parseRealEstatePrice("260.000")).toBe(260000);
    expect(parseRealEstatePrice("€260,000")).toBe(260000);
    expect(parseRealEstatePrice("€ 260.000")).toBe(260000);
  });

  it("parses size values without collapsing thousands into decimals", () => {
    expect(parseLocalizedNumber("3,700 sqm")).toBe(3700);
    expect(parseLocalizedNumber("3.700 m²")).toBe(3700);
    expect(parseLocalizedNumber("165 m²")).toBe(165);
    expect(parseLocalizedNumber("260.6 m²")).toBe(260.6);
  });
});
