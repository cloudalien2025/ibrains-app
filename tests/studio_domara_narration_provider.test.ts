import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
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
        { env: {} },
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

  it("builds an ElevenLabs request from Domara narration script and returns ready audio on mocked success", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-test-"));
    try {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toContain("/v1/text-to-speech/");
        expect(init?.method).toBe("POST");
        const parsed = JSON.parse(String(init?.body || "{}")) as { text?: string };
        expect(parsed.text).toContain("premium listing");
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from("FAKEAUDIO").buffer,
        } as unknown as Response;
      });

      const result = await generateNarrationAudio(
        {
          script: "A premium listing narration for Expat AI.",
          mode: "elevenlabs",
          persona: "expat_ai_host",
          tone: "cinematic",
          pace: "normal",
        },
        tmpDir,
        {
          env: {
            ELEVENLABS_API_KEY: "test-key",
            ELEVENLABS_VOICE_ID: "voice-1",
          },
          fetchImpl: fetchMock as unknown as typeof fetch,
        },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("ready");
      expect(result.provider).toBe("elevenlabs");
      expect(result.audioPath).toBeTruthy();
      const stats = await fs.stat(result.audioPath as string);
      expect(stats.size).toBeGreaterThan(0);
      expect(JSON.stringify(result).includes("test-key")).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns fallback on mocked ElevenLabs failure", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-test-"));
    try {
      const fetchMock = vi.fn(async () => {
        return {
          ok: false,
          status: 401,
          arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response;
      });

      const result = await generateNarrationAudio(
        {
          script: "Failure path narration.",
          mode: "elevenlabs",
          persona: "expat_ai_host",
          tone: "informative",
          pace: "normal",
        },
        tmpDir,
        {
          env: {
            ELEVENLABS_API_KEY: "test-key",
          },
          fetchImpl: fetchMock as unknown as typeof fetch,
        },
      );

      expect(result.status).toBe("fallback");
      expect(result.provider).toBe("elevenlabs");
      expect(result.audioPath).toBeUndefined();
      expect(result.fallbackReason).toContain("failed");
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
