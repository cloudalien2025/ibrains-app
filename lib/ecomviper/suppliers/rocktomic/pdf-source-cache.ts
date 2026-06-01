import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface CatalogPdfCacheMetadata {
  sourceUrl: string;
  sourceType: "catalog_pdf";
  downloadedAt: string;
  sourceVersion: string | null;
  contentHash: string;
  fileSizeBytes: number;
  filePath: string;
}

export interface CatalogPdfAcquisitionResult {
  available: boolean;
  source: "cache" | "downloaded" | "unavailable";
  filePath: string | null;
  metadata: CatalogPdfCacheMetadata | null;
  warnings: string[];
  errors: string[];
}

const DEFAULT_CACHE_DIR = path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/cache");
const DEFAULT_FILE_NAME = "Supplement-&-Apparel-Catalog.pdf";
const METADATA_FILE_NAME = "Supplement-&-Apparel-Catalog.metadata.json";

function nowIso(): string {
  return new Date().toISOString();
}

function cacheDirFromEnv(): string {
  return process.env.ECOMVIPER_SUPPLIER_ROCKTOMIC_CACHE_DIR?.trim() || DEFAULT_CACHE_DIR;
}

function sourceVersionFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const queryVersion = parsed.searchParams.get("t") || parsed.searchParams.get("v") || parsed.searchParams.get("version");
    if (queryVersion) return queryVersion;
    return parsed.search || null;
  } catch {
    return null;
  }
}

async function readMetadataIfPresent(metadataPath: string): Promise<CatalogPdfCacheMetadata | null> {
  try {
    const body = await fs.readFile(metadataPath, "utf8");
    const parsed = JSON.parse(body) as CatalogPdfCacheMetadata;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.filePath || !parsed.sourceUrl || !parsed.contentHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fileHashAndSize(filePath: string): Promise<{ contentHash: string; fileSizeBytes: number }> {
  const buffer = await fs.readFile(filePath);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    contentHash,
    fileSizeBytes: buffer.byteLength,
  };
}

async function createMetadata(input: {
  filePath: string;
  sourceUrl: string;
}): Promise<CatalogPdfCacheMetadata> {
  const hashAndSize = await fileHashAndSize(input.filePath);
  return {
    sourceUrl: input.sourceUrl,
    sourceType: "catalog_pdf",
    downloadedAt: nowIso(),
    sourceVersion: sourceVersionFromUrl(input.sourceUrl),
    contentHash: hashAndSize.contentHash,
    fileSizeBytes: hashAndSize.fileSizeBytes,
    filePath: input.filePath,
  };
}

async function writeMetadata(metadataPath: string, metadata: CatalogPdfCacheMetadata): Promise<void> {
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

export async function acquireCatalogPdfSource(input: {
  sourceUrl: string;
  allowLiveDownload: boolean;
}): Promise<CatalogPdfAcquisitionResult> {
  const cacheDir = cacheDirFromEnv();
  const pdfPath = path.join(cacheDir, DEFAULT_FILE_NAME);
  const metadataPath = path.join(cacheDir, METADATA_FILE_NAME);

  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const stat = await fs.stat(pdfPath);
    if (stat.isFile()) {
      const currentMetadata = await readMetadataIfPresent(metadataPath);
      const metadata = currentMetadata || await createMetadata({
        filePath: pdfPath,
        sourceUrl: input.sourceUrl,
      });
      if (!currentMetadata) {
        await fs.mkdir(cacheDir, { recursive: true });
        await writeMetadata(metadataPath, metadata);
      }
      return {
        available: true,
        source: "cache",
        filePath: pdfPath,
        metadata,
        warnings,
        errors,
      };
    }
  } catch {
    // cache miss
  }

  if (!input.allowLiveDownload) {
    return {
      available: false,
      source: "unavailable",
      filePath: null,
      metadata: null,
      warnings: ["pdf_cache_miss_live_download_disabled"],
      errors,
    };
  }

  try {
    await fs.mkdir(cacheDir, { recursive: true });
    const response = await fetch(input.sourceUrl, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return {
        available: false,
        source: "unavailable",
        filePath: null,
        metadata: null,
        warnings,
        errors: [`pdf_download_http_${response.status}`],
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength === 0) {
      return {
        available: false,
        source: "unavailable",
        filePath: null,
        metadata: null,
        warnings,
        errors: ["pdf_download_empty"],
      };
    }

    await fs.writeFile(pdfPath, buffer);
    const metadata = await createMetadata({
      filePath: pdfPath,
      sourceUrl: input.sourceUrl,
    });
    await writeMetadata(metadataPath, metadata);

    return {
      available: true,
      source: "downloaded",
      filePath: pdfPath,
      metadata,
      warnings,
      errors,
    };
  } catch (error) {
    return {
      available: false,
      source: "unavailable",
      filePath: null,
      metadata: null,
      warnings,
      errors: [error instanceof Error ? error.message : String(error || "pdf_download_failed")],
    };
  }
}

