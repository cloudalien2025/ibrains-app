import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DomaraVideoRenderPlan, DomaraVideoRenderResult } from "@/lib/studio/domara/render-plan";

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
}): Promise<void> {
  const fps = 30;
  const titleText = escapeDrawText(input.sceneTitle);
  const subtitleText = escapeDrawText(input.overlayText || `A property spotlight in ${input.market}`);
  const brandText = escapeDrawText(input.renderBrandText);
  const bottomY = 620;
  const titleY = 570;
  const vf = [
    "scale=1280:720:force_original_aspect_ratio=decrease",
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    `zoompan=z='min(zoom+0.0007,1.08)':d=${Math.max(1, Math.floor(input.durationSeconds * fps))}:s=1280x720`,
    "fps=30",
    "drawbox=x=0:y=520:w=1280:h=200:color=black@0.50:t=fill",
    `drawtext=text='${titleText}':x=60:y=${titleY}:fontsize=42:fontcolor=white`,
    `drawtext=text='${subtitleText}':x=60:y=${bottomY}:fontsize=30:fontcolor=white`,
    `drawtext=text='${brandText}':x=60:y=672:fontsize=24:fontcolor=white@0.9`,
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
          "drawbox=x=0:y=0:w=1280:h=720:color=#1e3a8a@0.28:t=fill",
          "drawbox=x=0:y=520:w=1280:h=200:color=black@0.56:t=fill",
          `drawtext=text='${titleText}':x=60:y=${titleY}:fontsize=42:fontcolor=white`,
          `drawtext=text='${subtitleText}':x=60:y=${bottomY}:fontsize=30:fontcolor=white`,
          `drawtext=text='${brandText}':x=60:y=672:fontsize=24:fontcolor=white@0.9`,
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

export async function renderDomaraPropertyVideo(renderPlan: DomaraVideoRenderPlan): Promise<DomaraVideoRenderResult> {
  const renderId = `${renderPlan.id}-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "domara-render-"));
  await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const downloadedImages: string[] = [];
  try {
    for (let i = 0; i < renderPlan.imageUrls.length; i += 1) {
      const url = renderPlan.imageUrls[i];
      if (!url) continue;
      try {
        const saved = await downloadImageAsset(url, tmpDir);
        downloadedImages.push(saved);
      } catch {
        // Keep rendering with remaining valid images.
      }
    }

    const segmentPaths: string[] = [];
    const sceneCount = renderPlan.timeline.length;
    const brandText = "Created for Expat AI";
    for (let index = 0; index < sceneCount; index += 1) {
      const scene = renderPlan.timeline[index];
      const segmentPath = path.join(tmpDir, `segment-${String(index + 1).padStart(2, "0")}.mp4`);
      const mappedImage = downloadedImages.length ? downloadedImages[index % downloadedImages.length] : undefined;
      await renderSceneSegment({
        segmentPath,
        imagePath: mappedImage,
        sceneTitle: scene.title,
        overlayText: scene.overlayText,
        durationSeconds: scene.durationSeconds,
        market: renderPlan.market,
        renderBrandText: brandText,
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

    const stats = await fs.stat(outputPath);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error("Render completed but output file is empty.");
    }

    return {
      status: "complete",
      renderId,
      downloadUrl: `/generated/domara/${outputFilename}`,
      filename: outputFilename,
      durationSeconds: renderPlan.totalDurationSeconds,
      sceneCount,
      imageCount: downloadedImages.length,
      renderMode: "mock-first local render",
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

