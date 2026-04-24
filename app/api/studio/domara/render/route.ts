import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  applyNarrationDurationToTimeline,
  createDomaraRenderPlan,
  DomaraVideoRenderRequest,
} from "@/lib/studio/domara/render-plan";
import { generateNarrationAudio } from "@/lib/studio/domara/narration-provider";
import { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";
import { renderDomaraPropertyVideo } from "@/lib/studio/domara/video-renderer";

export const runtime = "nodejs";

function badRequest(message: string, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        details,
      },
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  if (!payload || typeof payload !== "object") {
    return badRequest("Render payload object is required.");
  }

  const cast = payload as Partial<DomaraVideoRenderRequest>;
  if (!cast.plan || !cast.listingInput) {
    return badRequest("Both plan and listingInput are required.");
  }
  if (!cast.plan.id || !Array.isArray(cast.plan.scenes)) {
    return badRequest("Invalid plan payload.");
  }

  if (!cast.listingInput.title || !cast.listingInput.country) {
    return badRequest("Listing title and country are required.");
  }

  try {
    const plan = cast.plan as PropertyVideoPlan;
    const listingInput = cast.listingInput as PropertyListingInput;
    const baseRenderPlan = createDomaraRenderPlan({
      plan,
      listingInput,
      stylePreset: cast.stylePreset,
    });
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-narration-"));
    try {
      const narration = await generateNarrationAudio(
        {
          script: plan.narrationScript,
          mode: cast.voiceSettings?.mode || "silent",
          persona: cast.voiceSettings?.persona || "expat_ai_host",
          tone: cast.voiceSettings?.tone || "informative",
          pace: cast.voiceSettings?.pace || "normal",
        },
        tmpDir,
      );

      const renderPlan = applyNarrationDurationToTimeline(baseRenderPlan, narration.durationSeconds);
      const result = await renderDomaraPropertyVideo(renderPlan, narration);
      return NextResponse.json({
        ok: true,
        render: result,
        metadata: {
          timelineScenes: renderPlan.timeline.length,
          channel: renderPlan.channel,
          useCase: renderPlan.useCase,
          stylePreset: renderPlan.stylePreset,
          requestedImageCount: renderPlan.requestedImageCount,
          skippedImageCount: renderPlan.skippedImageCount,
          imageValidationWarnings: renderPlan.imageValidationWarnings,
          narrationProvider: narration.provider,
          narrationStatus: narration.status,
          narrationFallbackReason: narration.fallbackReason,
        },
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Failed to render Domara MP4.",
          details: error instanceof Error ? error.message : "Unknown rendering failure.",
        },
      },
      { status: 500 },
    );
  }
}
