import { describe, expect, it } from "vitest";
import { normalizeBrainList, resolveBrainRecordId } from "@/lib/brains/brainViews";

describe("brain view normalization", () => {
  it("keeps known and custom brains as distinct entries", () => {
    const payload = {
      brains: [
        { id: "directoryiq", name: "DirectoryIQ" },
        { id: "ecomviper", name: "EcomViper" },
        {
          slug: "custom-sales",
          name: "Custom Sales Brain",
          description: "Revenue intelligence",
        },
      ],
    };

    const normalized = normalizeBrainList(payload);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]?.id).toBe("directoryiq");
    expect(normalized[1]?.id).toBe("ecomviper");
    expect(normalized[2]?.id).toBe("custom-sales");
    expect(normalized[2]?.name).toBe("Custom Sales Brain");
    expect(normalized[2]?.primaryCtaText).toBe("Open Console");
  });

  it("resolves id using canonical fallbacks", () => {
    expect(resolveBrainRecordId({ brain_id: "brain-from-id" })).toBe("brain-from-id");
    expect(resolveBrainRecordId({ slug: "brain-from-slug" })).toBe("brain-from-slug");
    expect(resolveBrainRecordId({})).toBe("unknown_brain");
  });
});
