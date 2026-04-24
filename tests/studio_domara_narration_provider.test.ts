import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { generateNarrationAudio } from "@/lib/studio/domara/narration-provider";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const maybeIt = hasFfmpeg() ? it : it.skip;

describe("Domara narration provider", () => {
  it("returns safe fallback when ElevenLabs key is unavailable", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-test-"));
    try {
      const result = await generateNarrationAudio(
        {
          script: "Welcome to this listing.",
          mode: "elevenlabs",
          persona: "expat_ai_host",
          tone: "cinematic",
          pace: "normal",
        },
        tmpDir,
      );

      expect(result.status).toBe("fallback");
      expect(result.provider).toBe("elevenlabs");
      expect(result.audioPath).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("supports explicit silent mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-test-"));
    try {
      const result = await generateNarrationAudio(
        {
          script: "Silent run.",
          mode: "silent",
          persona: "expat_ai_host",
          tone: "informative",
          pace: "normal",
        },
        tmpDir,
      );

      expect(result.status).toBe("disabled");
      expect(result.provider).toBe("none");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  maybeIt("creates mock narration audio without external credentials", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-test-"));
    try {
      const result = await generateNarrationAudio(
        {
          script: "A premium listing tour for Expat AI viewers.",
          mode: "mock",
          persona: "expat_ai_host",
          tone: "warm",
          pace: "normal",
        },
        tmpDir,
      );

      expect(result.status).toBe("ready");
      expect(result.provider).toBe("mock");
      expect(result.audioPath).toBeTruthy();
      expect(result.durationSeconds).toBeGreaterThan(0);
      const stats = await fs.stat(result.audioPath as string);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }, 20000);
});
