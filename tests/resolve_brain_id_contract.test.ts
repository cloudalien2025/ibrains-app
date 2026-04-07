import { describe, expect, it } from "vitest";

import { resolveBrainId } from "@/lib/brains/resolveBrainId";

describe("resolveBrainId", () => {
  it("preserves canonical brilliant_directories id", () => {
    expect(resolveBrainId("brilliant_directories")).toBe("brilliant_directories");
    expect(resolveBrainId("brilliant-directories")).toBe("brilliant_directories");
  });

  it("keeps existing aliases intact", () => {
    expect(resolveBrainId("directoryiq")).toBe("brilliant_directories");
    expect(resolveBrainId("iPetzo")).toBe("ipetzo");
  });
});
