import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

const execFileAsync = promisify(execFile);
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

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

export type DomaraNarrationProviderDeps = {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

function estimateNarrationDurationSeconds(script: string, pace: DomaraVoicePace): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const wpm = pace === "relaxed" ? 120 : pace === "energetic" ? 170 : 145;
  const estimated = (words / wpm) * 60;
  return Math.max(8, Math.min(210, Math.round(estimated)));
}

function resolveElevenLabsVoiceId(env: NodeJS.ProcessEnv): string {
  const configured = (env.ELEVENLABS_VOICE_ID || "").trim();
  return configured || "EXAVITQu4vr4xnSDxMaL";
}

function paceStability(pace: DomaraVoicePace): number {
  if (pace === "relaxed") return 0.55;
  if (pace === "energetic") return 0.28;
  return 0.42;
}

function toneSimilarityBoost(tone: DomaraVoiceTone): number {
  if (tone === "cinematic") return 0.68;
  if (tone === "warm") return 0.56;
  if (tone === "luxury") return 0.62;
  return 0.5;
}

async function generateElevenLabsNarrationTrack(
  request: DomaraNarrationRequest,
  outputDir: string,
  deps: DomaraNarrationProviderDeps = {},
): Promise<DomaraNarrationResult> {
  const env = deps.env ?? process.env;
  const apiKey = (env.ELEVENLABS_API_KEY || "").trim();
  if (!apiKey) {
    return {
      status: "fallback",
      provider: "elevenlabs",
      fallbackReason: "ELEVENLABS_API_KEY is not configured. Rendered without narration audio.",
    };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const voiceId = resolveElevenLabsVoiceId(env);
  const script = request.script.trim();
  const durationSeconds = estimateNarrationDurationSeconds(script, request.pace);
  const audioPath = path.join(outputDir, `domara-elevenlabs-${createHash("sha1").update(script).digest("hex").slice(0, 8)}.mp3`);

  try {
    const response = await fetchImpl(`${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: paceStability(request.pace),
          similarity_boost: toneSimilarityBoost(request.tone),
          style: request.tone === "cinematic" ? 0.46 : request.tone === "luxury" ? 0.35 : 0.18,
          use_speaker_boost: true,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "fallback",
        provider: "elevenlabs",
        fallbackReason: `ElevenLabs synthesis failed (${response.status}). Rendered without narration audio.`,
      };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      return {
        status: "fallback",
        provider: "elevenlabs",
        fallbackReason: "ElevenLabs returned empty audio. Rendered without narration audio.",
      };
    }

    await fs.writeFile(audioPath, bytes);
    return {
      status: "ready",
      provider: "elevenlabs",
      audioPath,
      durationSeconds,
      voiceLabel: "Expat AI Host (ElevenLabs)",
    };
  } catch {
    return {
      status: "fallback",
      provider: "elevenlabs",
      fallbackReason: "ElevenLabs request failed. Rendered without narration audio.",
    };
  }
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
  deps: DomaraNarrationProviderDeps = {},
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
    return generateElevenLabsNarrationTrack(request, outputDir, deps);
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
