import { describe, expect, it } from "vitest";
import { resolveDetailMetricDisplayValue } from "@/lib/directoryiq/detailMetricState";

describe("detail metric terminal state mapping", () => {
  it("keeps loading state explicit", () => {
    expect(
      resolveDetailMetricDisplayValue({
        loading: true,
        unresolved: false,
        value: 4,
      })
    ).toBe("...");
  });

  it("maps unresolved state to em dash", () => {
    expect(
      resolveDetailMetricDisplayValue({
        loading: false,
        unresolved: true,
        value: 0,
      })
    ).toBe("—");
  });

  it("maps resolved numeric state to value string", () => {
    expect(
      resolveDetailMetricDisplayValue({
        loading: false,
        unresolved: false,
        value: 0,
      })
    ).toBe("0");
  });
});

