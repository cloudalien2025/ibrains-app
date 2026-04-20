import { describe, expect, it } from "vitest";
import {
  THRIVE_NATIVE_CONTRACT_REGISTRY,
  fingerprintNativePayload,
  getNativeContract,
  validatePayloadRequiredFields,
  validateResponseShape,
} from "@/lib/siteforge/thriveNativeContracts";

describe("siteforge thrive native contract registry", () => {
  it("defines required v1 operations with deterministic contracts", () => {
    expect(getNativeContract("assignTemplateToPost")?.endpoint).toContain("/wp-json/wp/v2/pages");
    expect(getNativeContract("createOrUpdateSymbol")?.objectType).toBe("tcb_symbol");
    expect(getNativeContract("createOrUpdateSection")?.objectType).toBe("thrive_section");
    expect(getNativeContract("createOrUpdateTemplateShellReference")?.objectType).toBe("thrive_template");
    expect(getNativeContract("attachReusablePrimitiveToPagePlan")?.endpoint).toContain("logical:");
    expect(getNativeContract("importArchitectContentArtifact")?.endpoint).toContain("artifact:");
    expect(getNativeContract("importThemeBuilderArtifact")?.endpoint).toContain("artifact:");

    for (const contract of Object.values(THRIVE_NATIVE_CONTRACT_REGISTRY)) {
      expect(contract.requiredPayloadFields.length).toBeGreaterThan(0);
      expect(contract.expectedResponseFields.length).toBeGreaterThan(0);
      expect(contract.allowedEnvironments).toEqual(expect.arrayContaining(["test", "development"]));
      expect(contract.fingerprint).toBe("sha256_json");
    }
  });

  it("validates payload and response shapes and computes stable fingerprints", () => {
    const payload = { title: "Hero", slug: "hero" };
    const fingerprintA = fingerprintNativePayload(payload);
    const fingerprintB = fingerprintNativePayload({ slug: "hero", title: "Hero" });

    expect(fingerprintA).toBe(fingerprintB);
    expect(validatePayloadRequiredFields(payload, ["title", "slug"]).ok).toBe(true);
    expect(validatePayloadRequiredFields(payload, ["title", "slug", "missing"]).ok).toBe(false);
    expect(validateResponseShape({ id: 10, slug: "hero" }, ["id", "slug"])).toBe(true);
    expect(validateResponseShape({ id: 10 }, ["id", "slug"])).toBe(false);
  });
});
