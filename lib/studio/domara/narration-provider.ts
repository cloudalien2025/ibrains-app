import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DomaraVoiceMode = "silent" | "mock" | "elevenlabs";
export type DomaraVoicePersona = "expat_ai_host";
export type DomaraVoiceTone = "cinematic" | "warm" | "luxury" | "informative";
export type DomaraVoicePace = "relaxed" | "normal" | "energetic";

export type DomaraNarrationRequest = {
  script: string;
  mode: DomaraVoiceMode;
  persona: DomaraVoicePersona;
  tone: DomaraVoiceTone;
  pace: DomaraVoicePace;
};

export type DomaraNarrationResult = {
  status: "disabled" | "ready" | "fallback";
  provider: "none" | "mock" | "elevenlabs";
  audioPath?: string;
  durationSeconds?: number;
  voiceLabel?: string;
  fallbackReason?: string;
};

function estimateNarrationDurationSeconds(script: string, pace: DomaraVoicePace): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const wpm = pace === "relaxed" ? 120 : pace === "energetic" ? 170 : 145;
  const estimated = (words / wpm) * 60;
  return Math.max(8, Math.min(210, Math.round(estimated)));
}

async function generateMockNarrationTrack(outputDir: string, durationSeconds: number): Promise<string> {
  const audioPath = path.join(outputDir, "domara-mock-narration.wav");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=180:sample_rate=48000:duration=${durationSeconds}`,
    "-af",
    "volume=0.04,afade=t=in:st=0:d=0.9",
    "-c:a",
    "pcm_s16le",
    audioPath,
  ]);
  return audioPath;
}

export async function generateNarrationAudio(
  request: DomaraNarrationRequest,
  outputDir: string,
): Promise<DomaraNarrationResult> {
  const script = request.script.trim();
  if (request.mode === "silent" || !script) {
    return {
      status: "disabled",
      provider: "none",
      fallbackReason: request.mode === "silent" ? "Voice mode set to silent/caption-only." : "Narration script is empty.",
    };
  }

  if (request.mode === "elevenlabs") {
    const apiKey = (process.env.ELEVENLABS_API_KEY || "").trim();
    if (!apiKey) {
      return {
        status: "fallback",
        provider: "elevenlabs",
        fallbackReason: "ELEVENLABS_API_KEY is not configured. Rendered without narration audio.",
      };
    }

    return {
      status: "fallback",
      provider: "elevenlabs",
      fallbackReason:
        "ElevenLabs provider seam is configured but direct synthesis is not enabled in this environment. Rendered without narration audio.",
    };
  }

  const durationSeconds = estimateNarrationDurationSeconds(script, request.pace);
  const audioPath = await generateMockNarrationTrack(outputDir, durationSeconds);
  return {
    status: "ready",
    provider: "mock",
    audioPath,
    durationSeconds,
    voiceLabel: "Expat AI Host (Mock)",
  };
}
