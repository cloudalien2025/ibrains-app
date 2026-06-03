export const runtime = "nodejs";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  insertFileIqExtractionJob,
  insertFileIqRawExtraction,
  insertFileIqSourceBundle,
  insertFileIqSourceFile,
  updateFileIqExtractionJob,
} from "@/lib/fileiq/fileiq-db";
import { runFileIqExtractionAgent } from "@/lib/fileiq/agent/fileiq-agent";

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function guessFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const typeMap: Record<string, string> = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".html": "html",
    ".htm": "html",
    ".png": "png",
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".ai": "ai",
    ".tif": "tif",
    ".tiff": "tif",
  };
  return typeMap[ext] ?? "unknown";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildExtractionPrompt(params: {
  jobId: string;
  bundleName: string;
  filePaths: Array<{ path: string; type: string }>;
  urls: string[];
}): string {
  const lines: string[] = [
    `You are extracting structured product facts for FileIQ extraction job ${params.jobId}.`,
    `Bundle: ${params.bundleName}`,
    "",
  ];

  if (params.filePaths.length > 0) {
    lines.push("FILES — read each using the Read tool:");
    for (const f of params.filePaths) {
      lines.push(`  - ${f.path} (type: ${f.type})`);
    }
    lines.push("");
  }

  if (params.urls.length > 0) {
    lines.push("URLS — fetch each using the WebFetch tool:");
    for (const u of params.urls) {
      lines.push(`  - ${u}`);
    }
    lines.push("");
  }

  lines.push(
    "TASK: Extract every product you can find across all sources.",
    "",
    "For each product extract as much as possible:",
    "  sku                 — product code or SKU (required)",
    "  productName         — full product name",
    "  category            — product category",
    "  servingSize         — serving size text",
    "  activeIngredients   — array of {name, amount, unit}",
    "  supplementFactsRaw  — raw supplement facts panel text",
    "  pricing             — {msrp, wholesaleCost, currency}",
    "  coaUrl              — Certificate of Analysis URL",
    "  warnings            — warning or disclaimer text",
    "  suggestedUse        — directions or suggested use",
    "  imageUrls           — product image or label URLs",
    "  sourceRef           — page/row/URL where this product was found",
    "",
    "Return ONLY valid JSON (no markdown, no code fence):",
    JSON.stringify(
      {
        products: [
          {
            sku: "EXAMPLE-001",
            productName: "Example Product",
            category: null,
            servingSize: null,
            activeIngredients: [],
            supplementFactsRaw: null,
            pricing: null,
            coaUrl: null,
            warnings: null,
            suggestedUse: null,
            imageUrls: [],
            sourceRef: "page 1",
          },
        ],
        totalProductsFound: 1,
        sourcesProcessed: 1,
        extractionNotes: "brief summary of what was found",
      },
      null,
      2,
    ),
    "",
    "Ground every fact in the source. Never invent values. Mark unknowns as null.",
  );

  return lines.join("\n");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Could not parse request body." },
      { status: 400 },
    );
  }

  const uploadedFiles = formData.getAll("file") as File[];

  let urls: string[] = [];
  const urlsRaw = formData.get("urls");
  if (typeof urlsRaw === "string" && urlsRaw.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(urlsRaw);
      if (Array.isArray(parsed)) {
        urls = parsed
          .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
          .map((u) => u.trim());
      }
    } catch {
      // malformed JSON — skip
    }
  }

  if (uploadedFiles.length === 0 && urls.length === 0) {
    return NextResponse.json(
      { error: "nothing_to_ingest", message: "No files or URLs provided." },
      { status: 400 },
    );
  }

  const supplierNameRaw = formData.get("supplier_name");
  const supplierName =
    typeof supplierNameRaw === "string" && supplierNameRaw.trim().length > 0
      ? supplierNameRaw.trim()
      : "Unknown Supplier";
  const supplierId = slugify(supplierName) || "unknown";
  const bundleId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const bundleName = `${supplierName} – ${new Date().toISOString().slice(0, 10)}`;

  try {
    await insertFileIqSourceBundle({
      id: bundleId,
      supplierId,
      name: bundleName,
      status: "ingesting",
      createdBy: userId!,
      metadata: { fileCount: uploadedFiles.length, urlCount: urls.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB write failed.";
    const isTableMissing =
      msg.includes("relation") && msg.includes("does not exist");
    return NextResponse.json(
      {
        error: isTableMissing ? "migration_required" : "db_error",
        message: isTableMissing
          ? "FileIQ tables are not yet migrated. Run: pnpm ecommerce:migrate"
          : msg,
      },
      { status: 503 },
    );
  }

  // Write uploaded files to a temp dir so the agent can read them.
  const tempDir = path.join("/tmp", `fileiq-${bundleId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const fileEntries: Array<{ id: string; filePath: string; type: string }> = [];
  for (const file of uploadedFiles) {
    const fileId = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = sha256(buffer);
    const safeName = path.basename(file.name);
    const filePath = path.join(tempDir, safeName);
    await fs.writeFile(filePath, buffer);
    await insertFileIqSourceFile({
      id: fileId,
      bundleId,
      supplierId,
      fileName: safeName,
      fileType: guessFileType(safeName),
      sourceRole: "uploaded_file",
      storageUri: filePath,
      contentHash,
      status: "registered",
      metadata: { originalName: file.name, sizeBytes: buffer.length },
    });
    fileEntries.push({ id: fileId, filePath, type: guessFileType(safeName) });
  }

  for (const url of urls) {
    const fileId = crypto.randomUUID();
    const contentHash = sha256(url);
    await insertFileIqSourceFile({
      id: fileId,
      bundleId,
      supplierId,
      fileName: url,
      fileType: "url",
      sourceRole: "url_source",
      storageUri: url,
      contentHash,
      status: "registered",
      metadata: {},
    });
  }

  await insertFileIqExtractionJob({
    id: jobId,
    bundleId,
    status: "running",
    extractorType: "claude_agent",
    summary: { fileCount: fileEntries.length, urlCount: urls.length },
  });

  const agentPrompt = buildExtractionPrompt({
    jobId,
    bundleName,
    filePaths: fileEntries.map((f) => ({ path: f.filePath, type: f.type })),
    urls,
  });

  const agentResult = await runFileIqExtractionAgent({
    jobId,
    bundleId,
    prompt: agentPrompt,
    cwd: fileEntries.length > 0 ? tempDir : undefined,
    additionalDirectories: fileEntries.length > 0 ? [tempDir] : undefined,
    maxTurns: 12,
  });

  let extractedPayload: Record<string, unknown> = {};
  let totalProductsFound = 0;
  if (agentResult.status === "completed" && agentResult.resultText) {
    try {
      const parsed: unknown = JSON.parse(agentResult.resultText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        extractedPayload = parsed as Record<string, unknown>;
        const count = (extractedPayload as { totalProductsFound?: unknown }).totalProductsFound;
        if (typeof count === "number") totalProductsFound = count;
      }
    } catch {
      extractedPayload = { raw: agentResult.resultText };
    }
  }

  const extractionId = crypto.randomUUID();
  await insertFileIqRawExtraction({
    id: extractionId,
    extractionJobId: jobId,
    sourceFileId: null,
    artifactType: "agent_result",
    storageUri: "inline:payload",
    payload: {
      ...extractedPayload,
      _meta: {
        agentSessionId: agentResult.agentSessionId,
        numTurns: agentResult.numTurns,
        totalCostUsd: agentResult.totalCostUsd,
        agentStatus: agentResult.status,
      },
    },
  });

  const dbStatus = agentResult.status === "completed" ? "completed" : "failed";
  await updateFileIqExtractionJob(jobId, {
    status: dbStatus,
    agentSessionId: agentResult.agentSessionId,
    errorCode: agentResult.errorCode,
    errorMessage: agentResult.errorMessage,
    summary: {
      fileCount: fileEntries.length,
      urlCount: urls.length,
      totalProductsFound,
      agentStatus: agentResult.status,
      numTurns: agentResult.numTurns,
    },
  });

  return NextResponse.json({
    bundleId,
    jobId,
    extractionId,
    status: agentResult.status,
    agentSessionId: agentResult.agentSessionId,
    totalProductsFound,
    fileCount: fileEntries.length,
    urlCount: urls.length,
    errorCode: agentResult.errorCode,
  });
}
