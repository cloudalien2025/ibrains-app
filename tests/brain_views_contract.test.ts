import { describe, expect, it } from "vitest";
import {
  isProductionVisibleBrain,
  normalizeBrainList,
  normalizeBrainRecord,
  resolveCanonicalBrainId,
  resolveBrainRecordId,
} from "@/lib/brains/brainViews";

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

  it("maps known upstream aliases to canonical brain ids", () => {
    expect(resolveCanonicalBrainId({ brain_id: "brilliant_directories" })).toBe("directoryiq");
    const normalized = normalizeBrainRecord({
      brain_id: "brilliant_directories",
      brain_name: "Brilliant Directories",
    });
    expect(normalized.id).toBe("directoryiq");
    expect(normalized.name).toBe("DirectoryIQ");
  });

  it("shows canonical and created non-test brains while hiding test/smoke entries", () => {
    expect(isProductionVisibleBrain({ id: "directoryiq", name: "DirectoryIQ" })).toBe(true);
    expect(isProductionVisibleBrain({ brain_id: "brilliant_directories" })).toBe(true);
    expect(isProductionVisibleBrain({ id: "ecomviper", name: "EcomViper" })).toBe(true);
    expect(isProductionVisibleBrain({ id: "studio", name: "Studio" })).toBe(true);
    expect(
      isProductionVisibleBrain({
        brain_id: "ipetzo",
        brain_name: "iPetzo",
        brain_type: "UAP",
      })
    ).toBe(true);
    expect(isProductionVisibleBrain({ id: "webdocs-smoke-1771960314" })).toBe(false);
    expect(isProductionVisibleBrain({ slug: "timedtext-fix-test" })).toBe(false);
  });
});
