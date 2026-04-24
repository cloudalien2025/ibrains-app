import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DomaraRenderStyle, DomaraVideoRenderPlan, DomaraVideoRenderResult } from "@/lib/studio/domara/render-plan";
import { DomaraNarrationResult } from "@/lib/studio/domara/narration-provider";

const execFileAsync = promisify(execFile);
const OUTPUT_DIRECTORY = path.join(process.cwd(), "public", "generated", "domara");

function escapeDrawText(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

function isPrivateIpv4(host: string): boolean {
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  const parts = host.split(".");
  if (parts.length === 4 && parts[0] === "172") {
    const second = Number(parts[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https image URLs are allowed.");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    throw new Error("Local/private hosts are not allowed for image fetch.");
  }

  const dnsResults = await lookup(host, { all: true }).catch(() => []);
  for (const result of dnsResults) {
    const address = result.address;
    if ((result.family === 4 && isPrivateIpv4(address)) || (result.family === 6 && isPrivateIpv6(address))) {
      throw new Error("Resolved private network address is not allowed.");
    }
  }

  return parsed;
}

async function downloadImageAsset(rawUrl: string, outputDir: string): Promise<string> {
  const safeUrl = await assertSafeRemoteUrl(rawUrl);
  const response = await fetch(safeUrl.toString(), { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`Image fetch failed with status ${response.status}.`);

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedTypes.some((type) => contentType.includes(type))) {
    throw new Error("Unsupported image content type.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("Image body was empty.");
  if (buffer.length > 15 * 1024 * 1024) throw new Error("Image exceeds 15MB limit.");

  const digest = createHash("sha1").update(rawUrl).digest("hex").slice(0, 12);
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const filepath = path.join(outputDir, `img-${digest}.${ext}`);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

async function renderSceneSegment(input: {
  segmentPath: string;
  imagePath?: string;
  sceneTitle: string;
  overlayText: string;
  durationSeconds: number;
  market: string;
  renderBrandText: string;
  stylePreset: DomaraRenderStyle;
  sceneOrder: number;
  sceneTotal: number;
}): Promise<void> {
  const fps = 30;
  const titleText = escapeDrawText(input.sceneTitle);
  const subtitleText = escapeDrawText(input.overlayText || `A property spotlight in ${input.market}`);
  const brandText = escapeDrawText(input.renderBrandText);
  const styleTheme =
    input.stylePreset === "premium_listing"
      ? { accent: "#ca8a04", titleY: 554, subtitleY: 612, brandY: 670, overlayAlpha: "0.56" }
      : input.stylePreset === "property_showcase"
        ? { accent: "#0ea5e9", titleY: 560, subtitleY: 618, brandY: 674, overlayAlpha: "0.52" }
        : { accent: "#2563eb", titleY: 558, subtitleY: 616, brandY: 672, overlayAlpha: "0.54" };
  const sceneCounter = escapeDrawText(`Scene ${input.sceneOrder}/${input.sceneTotal}`);
  const vf = [
    "scale=1280:720:force_original_aspect_ratio=decrease",
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    `zoompan=z='if(lte(mod(on\\,2)\\,1),min(zoom+0.00075,1.09),max(zoom-0.00055,1.01))':d=${Math.max(1, Math.floor(input.durationSeconds * fps))}:s=1280x720`,
    "fps=30",
    "drawbox=x=0:y=0:w=1280:h=720:color=black@0.15:t=fill",
    `drawbox=x=0:y=516:w=1280:h=204:color=black@${styleTheme.overlayAlpha}:t=fill`,
    `drawbox=x=56:y=${styleTheme.titleY - 10}:w=6:h=74:color=${styleTheme.accent}@0.95:t=fill`,
    `drawtext=text='${titleText}':x=72:y=${styleTheme.titleY}:fontsize=45:fontcolor=white`,
    `drawtext=text='${subtitleText}':x=72:y=${styleTheme.subtitleY}:fontsize=30:fontcolor=white@0.96`,
    `drawtext=text='${sceneCounter}':x=1104:y=24:fontsize=21:fontcolor=white@0.88`,
    `drawtext=text='${brandText}':x=72:y=${styleTheme.brandY}:fontsize=24:fontcolor=white@0.9`,
  ].join(",");

  const args = input.imagePath
    ? [
        "-y",
        "-loop",
        "1",
        "-i",
        input.imagePath,
        "-t",
        String(input.durationSeconds),
        "-vf",
        vf,
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        input.segmentPath,
      ]
    : [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=#0f172a:s=1280x720:r=30",
        "-t",
        String(input.durationSeconds),
        "-vf",
      [
          "drawbox=x=0:y=0:w=1280:h=720:color=#0f172a@1:t=fill",
          `drawbox=x=0:y=0:w=1280:h=190:color=${styleTheme.accent}@0.22:t=fill`,
          `drawbox=x=0:y=516:w=1280:h=204:color=black@${styleTheme.overlayAlpha}:t=fill`,
          `drawbox=x=56:y=${styleTheme.titleY - 10}:w=6:h=74:color=${styleTheme.accent}@0.95:t=fill`,
          `drawtext=text='${titleText}':x=72:y=${styleTheme.titleY}:fontsize=45:fontcolor=white`,
          `drawtext=text='${subtitleText}':x=72:y=${styleTheme.subtitleY}:fontsize=30:fontcolor=white@0.96`,
          `drawtext=text='${sceneCounter}':x=1104:y=24:fontsize=21:fontcolor=white@0.88`,
          `drawtext=text='${brandText}':x=72:y=${styleTheme.brandY}:fontsize=24:fontcolor=white@0.9`,
        ].join(","),
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        input.segmentPath,
      ];

  await execFileAsync("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 });
}

export async function renderDomaraPropertyVideo(
  renderPlan: DomaraVideoRenderPlan,
  narration?: DomaraNarrationResult,
): Promise<DomaraVideoRenderResult> {
  const renderId = `${renderPlan.id}-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-render-"));
  await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const downloadedImages: string[] = [];
  const downloadedBySource = new Map<string, string>();
  let downloadFailures = 0;
  try {
    const allImageSources = Array.from(
      new Set([...renderPlan.imageUrls, ...renderPlan.timeline.map((scene) => scene.imageUrl).filter(Boolean)]),
    ) as string[];

    for (let i = 0; i < allImageSources.length; i += 1) {
      const url = allImageSources[i];
      if (!url) continue;
      try {
        const saved = await downloadImageAsset(url, tmpDir);
        downloadedImages.push(saved);
        downloadedBySource.set(url, saved);
      } catch {
        // Keep rendering with remaining valid images.
        downloadFailures += 1;
      }
    }

    const segmentPaths: string[] = [];
    const sceneCount = renderPlan.timeline.length;
    const brandText = "Created for Expat AI";
    for (let index = 0; index < sceneCount; index += 1) {
      const scene = renderPlan.timeline[index];
      const segmentPath = path.join(tmpDir, `segment-${String(index + 1).padStart(2, "0")}.mp4`);
      const sceneSpecificImage = scene.imageUrl ? downloadedBySource.get(scene.imageUrl) : undefined;
      const mappedImage = sceneSpecificImage || (downloadedImages.length ? downloadedImages[index % downloadedImages.length] : undefined);
      await renderSceneSegment({
        segmentPath,
        imagePath: mappedImage,
        sceneTitle: scene.title,
        overlayText: scene.overlayText,
        durationSeconds: scene.durationSeconds,
        market: renderPlan.market,
        renderBrandText: brandText,
        stylePreset: renderPlan.stylePreset,
        sceneOrder: index + 1,
        sceneTotal: sceneCount,
      });
      segmentPaths.push(segmentPath);
    }

    const concatFile = path.join(tmpDir, "concat.txt");
    await fs.writeFile(
      concatFile,
      segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );

    const outputFilename = `${renderId}.mp4`;
    const outputPath = path.join(OUTPUT_DIRECTORY, outputFilename);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c:v", "libx264", "-pix_fmt", "yuv420p", outputPath],
      { maxBuffer: 8 * 1024 * 1024 },
    );

    let finalOutputPath = outputPath;
    if (narration?.status === "ready" && narration.audioPath) {
      const muxedOutputPath = path.join(OUTPUT_DIRECTORY, `${renderId}-narrated.mp4`);
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          outputPath,
          "-i",
          narration.audioPath,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          muxedOutputPath,
        ],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      await fs.rm(outputPath, { force: true });
      finalOutputPath = muxedOutputPath;
    }

    const stats = await fs.stat(finalOutputPath);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error("Render completed but output file is empty.");
    }

    const finalFile = path.basename(finalOutputPath);
    return {
      status: "complete",
      renderId,
      downloadUrl: `/generated/domara/${finalFile}`,
      outputPath: `/generated/domara/${finalFile}`,
      filename: finalFile,
      durationSeconds: renderPlan.totalDurationSeconds,
      sceneCount,
      imageCount: downloadedImages.length,
      skippedImageCount: renderPlan.skippedImageCount + downloadFailures,
      renderMode: "mock-first local render",
      stylePreset: renderPlan.stylePreset,
      generatedAt: new Date().toISOString(),
      audioIncluded: narration?.status === "ready" && !!narration.audioPath,
      narrationProvider: narration?.provider ?? "none",
      narrationStatus: narration?.status ?? "disabled",
      narrationDurationSeconds: narration?.durationSeconds,
      narrationFallbackReason: narration?.fallbackReason,
      mapVisualProvider: renderPlan.mapVisualProvider,
      mapAttribution: renderPlan.mapAttribution,
      mapFallbackReason: renderPlan.mapFallbackReason,
      sourceAttribution: renderPlan.sourceAttribution,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
