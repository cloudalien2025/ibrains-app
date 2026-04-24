import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { renderDomaraPropertyVideo } from "@/lib/studio/domara/video-renderer";
import { DomaraVideoRenderPlan } from "@/lib/studio/domara/render-plan";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const maybeIt = hasFfmpeg() ? it : it.skip;

describe("renderDomaraPropertyVideo smoke", () => {
  maybeIt("creates a playable mp4 artifact in fallback mode", async () => {
    const renderPlan: DomaraVideoRenderPlan = {
      id: "domara-render-smoke",
      channel: "Expat AI",
      useCase: "property_video_engine",
      market: "Italy",
      title: "Smoke Test Listing",
      imageUrls: [],
      requestedImageCount: 0,
      skippedImageCount: 0,
      imageValidationWarnings: [],
      totalDurationSeconds: 4,
      renderMode: "mock-first local render",
      stylePreset: "expat_ai_editorial",
      sourceAttribution: {
        source: "Manual",
      },
      timeline: [
        {
          order: 1,
          title: "Opening Hook",
          overlayText: "A property spotlight in Florence, Italy",
          narration: "Opening scene",
          durationSeconds: 2,
        },
        {
          order: 2,
          title: "Closing CTA",
          overlayText: "Created for Expat AI",
          narration: "Closing scene",
          durationSeconds: 2,
        },
      ],
    };

    const result = await renderDomaraPropertyVideo(renderPlan);
    const absolutePath = path.join(process.cwd(), "public", result.downloadUrl.replace(/^\//, ""));
    const stats = await fs.stat(absolutePath);

    expect(result.filename.endsWith(".mp4")).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
    expect(result.audioIncluded).toBe(false);
    expect(result.stylePreset).toBe("expat_ai_editorial");

    await fs.rm(absolutePath, { force: true });
  }, 30000);
});
