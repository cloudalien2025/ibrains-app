import { describe, expect, it } from "vitest";
import {
  createVisionCacheKey,
  extractSupplementFactsViaOpenAiVision,
} from "@/lib/ecomviper/suppliers/rocktomic/openai-vision-supplement-facts";

describe("rocktomic openai vision fallback gating", () => {
  it("skips when CLI flag is disabled", async () => {
    const result = await extractSupplementFactsViaOpenAiVision({
      enabledByCli: false,
      imagePath: null,
      sku: "ROC948",
      productName: "Premium Nitric Oxide Gummies",
      provenance: [],
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("cli_flag_disabled");
  });

  it("produces stable vision cache keys", () => {
    const keyA = createVisionCacheKey({
      imageHash: "abc",
      model: "gpt-4.1-mini",
      schemaVersion: "v1",
    });
    const keyB = createVisionCacheKey({
      imageHash: "abc",
      model: "gpt-4.1-mini",
      schemaVersion: "v1",
    });
    const keyC = createVisionCacheKey({
      imageHash: "different",
      model: "gpt-4.1-mini",
      schemaVersion: "v1",
    });
    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});

