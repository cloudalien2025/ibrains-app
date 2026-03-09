import { describe, expect, it } from "vitest";
import * as layout from "@/app/(brains)/directoryiq/layout";

describe("directoryiq layout gating", () => {
  it("forces dynamic rendering for per-request entitlement headers", () => {
    expect(layout.dynamic).toBe("force-dynamic");
    expect(layout.runtime).toBe("nodejs");
  });
});
