export const runtime = "nodejs";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  insertFileIqExtractionJob,
  insertFileIqSourceBundle,
  insertFileIqSourceFile,
} from "@/lib/fileiq/fileiq-db";
import { classifyExtractionJob } from "@/lib/fileiq/performance-router";
import { fetchUrl, type UrlSourceResult } from "@/lib/fileiq/sources/url-source";
import { detectSupplierName, supplierIdFromName } from "@/lib/fileiq/supplier-detection";

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function guessFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const typeMap: Record<string, string> = {
    ".csv": "csv",
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".xls": "xlsx",
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

const PRODUCT_INTENT_KEYWORDS = [
  "extract",
  "sku",
  "product",
  "catalog",
  "supplement",
  "pricing",
  "inventory",
];

function isProductCatalogIntent(params: {
  intent?: string;
  bundleName: string;
  filePaths: Array<{ path: string; type: string }>;
}): boolean {
  const haystack = [
    params.intent ?? "",
    params.bundleName,
    ...params.filePaths.map((f) => f.path),
  ]
    .join(" ")
    .toLowerCase();
  return PRODUCT_INTENT_KEYWORDS.some((kw) => haystack.includes(kw));
}

const CATALOG_SCHEMA_EXAMPLE = JSON.stringify(
  {
    schemaType: "product_catalog",
    schemaVersion: "1.1",
    supplier: {
      supplierId: "acme-co",
      name: "Acme Co",
      supplierName: "Acme Co",
      website: null,
      contactEmail: null,
      contactPhone: null,
    },
    products: [
      {
        sku: "ACM-001",
        productName: "Example Supplement",
        productType: "supplement",
        category: null,
        subcategory: null,
        brand: null,
        upc: null,
        asin: null,
        inventory: {
          status: "in_stock",
          quantityOnHand: null,
          reorderPoint: null,
          leadTimeDays: null,
          moq: null,
        },
        pricing: {
          msrp: null,
          wholesaleCost: null,
          currency: "USD",
          wholesaleTiers: {
            nonMember: null,
            standard: null,
            vipPlus: null,
            basic: null,
            launch: null,
            scale: null,
          },
          mapPrice: null,
          salePrice: null,
        },
        physical: {
          weightLbs: null,
          weightOz: null,
          heightIn: null,
          widthIn: null,
          depthIn: null,
          unitCount: null,
          unitCountType: null,
        },
        details: {
          description: null,
          shortDescription: null,
          suggestedUse: null,
          warnings: null,
          storageInstructions: null,
          countryOfOrigin: null,
          certifications: [],
          flavor: null,
          form: null,
          coaUrl: null,
        },
        supplementFacts: {
          servingSize: null,
          servingsPerContainer: null,
          ingredients: [{ name: "Vitamin C", amount: "500", unit: "mg", dailyValue: "556%" }],
          otherIngredients: null,
          allergenWarning: null,
          raw: null,
        },
        assets: {
          imageUrls: [],
          labelUrls: [],
          coaUrls: [],
          sheetUrls: [],
          videoUrls: [],
          coaExpiryDate: null,
        },
        shipping: {
          shipsFromState: null,
          shipsFromCountry: null,
          freeShippingThreshold: null,
          standardRoute: { carriers: [], fulfillmentDays: null, transitDays: null, totalEstimatedDays: null },
          expeditedRoute: null,
          internationalAvailable: null,
          hazmat: null,
        },
        agenticVisibility: { priorityScore: null, tags: [], relatedSkus: [], bundleSuggestions: [], notes: null, certifications: [] },
        seo: { metaTitle: null, metaDescription: null, keywords: [], canonicalUrl: null },
        policy: { refundWindowDays: null, refundType: null, returnShippingPaidBy: null, policyNotes: null },
        extraction: { sourceRef: "page 1", sourceFileId: null, extractedAt: null, confidence: null, extractionNotes: null },
      },
    ],
    totalProductsFound: 1,
    sourcesProcessed: 1,
    extractionNotes: "brief summary of what was found and any gaps",
  },
  null,
  2,
);

function buildExtractionPrompt(params: {
  jobId: string;
  bundleName: string;
  filePaths: Array<{ path: string; type: string }>;
  urls: string[];
  intent?: string;
}): string {
  const lines: string[] = [
    `You are extracting structured product facts for FileIQ extraction job ${params.jobId}.`,
    `Bundle: ${params.bundleName}`,
  ];

  if (params.intent) {
    lines.push(`USER INTENT: ${params.intent}`);
  }

  lines.push("");

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

  if (isProductCatalogIntent(params)) {
    lines.push(
      "TASK: Extract every product you can find across all sources and return a FileIQ Product Catalog (schema v1.1).",
      "",
      "CRITICAL OUTPUT RULES — follow exactly:",
      "  1. Output ONLY valid JSON. No prose before or after the JSON.",
      "  2. Do NOT wrap the JSON in markdown code fences (no ``` or ```json).",
      "  3. Your entire response must be parseable by JSON.parse().",
      "",
      "Set schemaType to \"product_catalog\" and schemaVersion to \"1.1\".",
      "Populate every field you can find in the source. Set unknown fields to null or [].",
      "If the source is inventory-only (no product catalog), populate inventory, sku, and productName where available; set all other product fields to null or empty arrays.",
      "Ground every fact in the source — never invent values.",
    );

    if (params.intent) {
      lines.push(
        "",
        `PRIORITY: The user said "${params.intent}". Prioritize those fields and make sure they are as complete as possible.`,
      );
    }

    lines.push("", "REQUIRED JSON SHAPE:", CATALOG_SCHEMA_EXAMPLE);
  } else {
    lines.push(
      "TASK: Extract every product you can find across all sources.",
      "",
      "CRITICAL OUTPUT RULES — follow exactly:",
      "  1. Output ONLY valid JSON. No prose before or after the JSON.",
      "  2. Do NOT wrap the JSON in markdown code fences (no ``` or ```json).",
      "  3. Your entire response must be parseable by JSON.parse().",
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

    if (params.intent) {
      lines.push(`Tailor your extraction and output structure to answer: ${params.intent}`);
    }
  }

  return lines.join("\n");
}

const LOG = "[fileiq:ingest]";

interface PreparedUpload {
  file: File;
  safeName: string;
  buffer: Buffer;
  type: string;
  contentHash: string;
  contentHint: string;
}

interface PreparedUrlSource {
  url: string;
  fetched: UrlSourceResult;
  safeName: string;
  filePath: string;
  contentHash: string;
  sourceRef: string;
}

function textHintFromBuffer(buffer: Buffer, fileType: string): string {
  if (!["csv", "txt", "html", "markdown", "unknown"].includes(fileType)) return "";
  return buffer.toString("utf8", 0, Math.min(buffer.length, 8_000));
}

function sourceRefForFetchedUrl(result: UrlSourceResult): string {
  return `${result.sourceUrl} scrapedAt=${result.scrapedAt} fetchMethod=${result.method}`;
}

function safeUrlFileName(url: string, index: number): string {
  let host = "url";
  try {
    host = new URL(url).hostname.replace(/[^a-z0-9.-]+/gi, "-");
  } catch {
    host = "url";
  }
  return `url-${index + 1}-${host}.md`;
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

  const intentRaw = formData.get("intent");
  const intent =
    typeof intentRaw === "string" && intentRaw.trim().length > 0
      ? intentRaw.trim()
      : undefined;

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

  const bundleId = crypto.randomUUID();
  const jobId = crypto.randomUUID();

  // Prepare source content before creating the DB job. URL sources are fetched
  // into markdown files so the worker can use the normal Read-based pipeline.
  const tempDir = path.join("/tmp", `fileiq-${bundleId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const preparedUploads: PreparedUpload[] = [];
  for (const file of uploadedFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = path.basename(file.name);
    const type = guessFileType(safeName);
    preparedUploads.push({
      file,
      safeName,
      buffer,
      type,
      contentHash: sha256(buffer),
      contentHint: textHintFromBuffer(buffer, type),
    });
  }

  const preparedUrls: PreparedUrlSource[] = [];
  try {
    for (const [index, url] of urls.entries()) {
      const fetched = await fetchUrl(url);
      const sourceRef = sourceRefForFetchedUrl(fetched);
      const safeName = safeUrlFileName(url, index);
      const filePath = path.join(tempDir, safeName);
      const markdown = [
        `# ${fetched.title ?? fetched.sourceUrl}`,
        "",
        `Source URL: ${fetched.sourceUrl}`,
        `Scraped At: ${fetched.scrapedAt}`,
        `Fetch Method: ${fetched.method}`,
        `SourceRef: ${sourceRef}`,
        "",
        fetched.markdown,
      ].join("\n");
      await fs.writeFile(filePath, markdown, "utf8");
      preparedUrls.push({
        url,
        fetched,
        safeName,
        filePath,
        contentHash: sha256(markdown),
        sourceRef,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "URL fetch failed.";
    return NextResponse.json(
      { error: "url_fetch_failed", message: msg },
      { status: msg.includes("FIRECRAWL_API_KEY") ? 503 : 502 },
    );
  }

  const supplierNameRaw = formData.get("supplier_name");
  const supplierName = detectSupplierName({
    explicitSupplierName:
      typeof supplierNameRaw === "string" && supplierNameRaw.trim().length > 0
        ? supplierNameRaw.trim()
        : null,
    fileNames: preparedUploads.map((entry) => entry.safeName),
    contentHints: [
      ...preparedUploads.map((entry) => entry.contentHint),
      ...preparedUrls.map((entry) => entry.fetched.markdown.slice(0, 8_000)),
    ],
    urls,
  });
  const supplierId = supplierIdFromName(supplierName);
  const bundleName = `${supplierName} – ${new Date().toISOString().slice(0, 10)}`;
  const fetchMethod: "sdk" | "firecrawl" =
    preparedUrls.some((entry) => entry.fetched.method === "firecrawl") ? "firecrawl" : "sdk";

  console.log(`${LOG} jobId=${jobId} bundleId=${bundleId} | start | supplier=${supplierId} fileCount=${uploadedFiles.length} urlCount=${urls.length}`);

  try {
    await insertFileIqSourceBundle({
      id: bundleId,
      supplierId,
      name: bundleName,
      status: "ingesting",
      createdBy: userId!,
      metadata: {
        fileCount: uploadedFiles.length,
        urlCount: urls.length,
        supplierName,
        ...(preparedUrls.length > 0 && {
          fetchMethod,
          sourceRefs: preparedUrls.map((entry) => entry.sourceRef),
        }),
      },
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

  const fileEntries: Array<{ id: string; filePath: string; type: string }> = [];
  for (const upload of preparedUploads) {
    const fileId = crypto.randomUUID();
    const filePath = path.join(tempDir, upload.safeName);
    await fs.writeFile(filePath, upload.buffer);
    await insertFileIqSourceFile({
      id: fileId,
      bundleId,
      supplierId,
      fileName: upload.safeName,
      fileType: upload.type,
      sourceRole: "uploaded_file",
      storageUri: filePath,
      contentHash: upload.contentHash,
      status: "registered",
      metadata: { originalName: upload.file.name, sizeBytes: upload.buffer.length },
    });
    fileEntries.push({ id: fileId, filePath, type: upload.type });
  }

  for (const urlSource of preparedUrls) {
    const fileId = crypto.randomUUID();
    await insertFileIqSourceFile({
      id: fileId,
      bundleId,
      supplierId,
      fileName: urlSource.safeName,
      fileType: "markdown",
      sourceRole: "url_source",
      storageUri: urlSource.filePath,
      contentHash: urlSource.contentHash,
      status: "registered",
      metadata: {
        originalUrl: urlSource.url,
        sourceUrl: urlSource.fetched.sourceUrl,
        title: urlSource.fetched.title,
        scrapedAt: urlSource.fetched.scrapedAt,
        fetchMethod: urlSource.fetched.method,
        sourceRef: urlSource.sourceRef,
      },
    });
    fileEntries.push({ id: fileId, filePath: urlSource.filePath, type: "markdown" });
  }

  const filePaths = fileEntries.map((f) => ({ path: f.filePath, type: f.type }));

  const routerDecision = classifyExtractionJob({ filePaths, urls, intent });

  const agentPrompt = buildExtractionPrompt({
    jobId,
    bundleName,
    filePaths,
    urls,
    intent,
  });

  console.log(
    `${LOG} jobId=${jobId} | router | route=${routerDecision.route} maxTurns=${routerDecision.maxTurns} rationale=${routerDecision.rationale}`,
  );

  await insertFileIqExtractionJob({
    id: jobId,
    bundleId,
    status: "pending",
    extractorType: "claude_agent",
    summary: {
      fileCount: fileEntries.length,
      urlCount: urls.length,
      supplierName,
      ...(preparedUrls.length > 0 && {
        fetchMethod,
        sourceRef: preparedUrls[0].sourceRef,
        sourceRefs: preparedUrls.map((entry) => entry.sourceRef),
        urlSources: preparedUrls.map((entry) => ({
          title: entry.fetched.title,
          sourceUrl: entry.fetched.sourceUrl,
          scrapedAt: entry.fetched.scrapedAt,
          fetchMethod: entry.fetched.method,
          sourceRef: entry.sourceRef,
        })),
      }),
      _worker: {
        agentPrompt,
        cwd: fileEntries.length > 0 ? tempDir : null,
        additionalDirectories: fileEntries.length > 0 ? [tempDir] : [],
        maxTurns: routerDecision.maxTurns,
        route: routerDecision.route,
        routeRationale: routerDecision.rationale,
        filePaths,
        urls,
      },
    },
  });

  console.log(`${LOG} jobId=${jobId} bundleId=${bundleId} status=pending | queued | fileCount=${fileEntries.length} urlCount=${urls.length}`);

  return NextResponse.json({ jobId, bundleId, status: "pending" });
}
