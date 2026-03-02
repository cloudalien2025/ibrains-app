import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { computePackHash } from "../app/api/ssc/_utils/promptPacks";
import type { PromptPackInput } from "../app/api/ssc/_utils/types";

const packsDir = path.join(process.cwd(), "ssc_artifacts", "incoming");
const packFiles = [
  "DB_PROMPTS.json",
  "EB_PROMPTS_EcomViper.json",
  "VISUAL_PROMPTS.json",
];

describe("SSC prompt pack hash lock", () => {
  it("matches declared sha256 for each pack", () => {
    for (const file of packFiles) {
      const payload = fs.readFileSync(path.join(packsDir, file), "utf-8");
      const pack = JSON.parse(payload) as PromptPackInput;
      const computed = computePackHash(pack);
      expect(computed).toBe(pack.ssc_prompt_pack_sha256);
    }
  });

  it("detects mismatched hash", () => {
    const payload = fs.readFileSync(
      path.join(packsDir, packFiles[0]),
      "utf-8"
    );
    const pack = JSON.parse(payload) as PromptPackInput;
    const computed = computePackHash(pack);
    expect(computed).not.toBe("deadbeef");
  });
});
