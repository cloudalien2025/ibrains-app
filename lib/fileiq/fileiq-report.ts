import "server-only";

import type { FileIqOwnedJob, FileIqStoredArtifact } from "@/lib/fileiq/fileiq-db-core";

interface ReportLine {
  text: string;
  bold?: boolean;
  fontSize?: number;
}

interface FileIqPdfReport {
  buffer: Buffer;
  fileName: string;
  title: string;
  schemaType: string;
  schemaVersion: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN_X = 50;
const PAGE_MARGIN_Y = 48;
const DEFAULT_FONT_SIZE = 11;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatCurrency(value: number | null | undefined, currency = "USD"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "fileiq-report";
}

function wrapText(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function chunkReportLines(lines: ReportLine[]): ReportLine[][] {
  const pages: ReportLine[][] = [];
  let currentPage: ReportLine[] = [];
  let currentY = PAGE_HEIGHT - PAGE_MARGIN_Y;

  for (const line of lines) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    const maxChars = Math.max(24, Math.floor((fontSize <= 11 ? 96 : 78) * (11 / fontSize)));
    const wrapped = wrapText(line.text, maxChars);
    for (const wrappedLine of wrapped) {
      const effectiveLine: ReportLine = {
        ...line,
        text: wrappedLine,
      };
      const lineHeight = (effectiveLine.fontSize ?? DEFAULT_FONT_SIZE) + 4;
      if (currentY - lineHeight < PAGE_MARGIN_Y) {
        pages.push(currentPage);
        currentPage = [];
        currentY = PAGE_HEIGHT - PAGE_MARGIN_Y;
      }
      currentPage.push(effectiveLine);
      currentY -= lineHeight;
    }
  }

  if (currentPage.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildPdfBuffer(lines: ReportLine[]): Buffer {
  const pages = chunkReportLines(lines);
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageObjectIds: number[] = [];

  for (const pageLines of pages) {
    const commands: string[] = [];
    let currentY = PAGE_HEIGHT - PAGE_MARGIN_Y;
    for (const line of pageLines) {
      const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
      const fontRef = line.bold ? "/F2" : "/F1";
      commands.push(
        `BT ${fontRef} ${fontSize} Tf ${PAGE_MARGIN_X} ${currentY} Td (${escapePdfText(line.text)}) Tj ET`,
      );
      currentY -= fontSize + 4;
    }
    const stream = commands.join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  const header = "%PDF-1.4\n";
  const bodyParts: string[] = [];
  const offsets: number[] = [];
  let currentOffset = Buffer.byteLength(header, "utf8");

  for (let index = 0; index < objects.length; index += 1) {
    const objectBody = `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    offsets.push(currentOffset);
    bodyParts.push(objectBody);
    currentOffset += Buffer.byteLength(objectBody, "utf8");
  }

  const xrefOffset = currentOffset;
  const xref = [
    `xref`,
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `),
    `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    `startxref`,
    `${xrefOffset}`,
    "%%EOF",
  ].join("\n");

  return Buffer.from(header + bodyParts.join("") + xref, "utf8");
}

function extractValidationNotes(job: FileIqOwnedJob, payload: Record<string, unknown>): string[] {
  const notes: string[] = [];
  const extractionNotes = asText(payload.extractionNotes);
  if (extractionNotes) notes.push(`Extraction notes: ${extractionNotes}`);

  const payloadSummary = isRecord(payload.summary) ? payload.summary : null;
  const normalizationNotes = payloadSummary?.normalizationNotes;
  if (Array.isArray(normalizationNotes)) {
    for (const note of normalizationNotes) {
      const text = asText(note);
      if (text) notes.push(`Normalization: ${text}`);
    }
  }

  const payloadMeta = isRecord(payload._meta) ? payload._meta : null;
  const agentValidation = payloadMeta && isRecord(payloadMeta.agentValidation)
    ? payloadMeta.agentValidation
    : null;
  const agentValidationNotes = agentValidation?.normalizationNotes;
  if (Array.isArray(agentValidationNotes)) {
    for (const note of agentValidationNotes) {
      const text = asText(note);
      if (text) notes.push(`Validation: ${text}`);
    }
  }

  if (job.summary.agentStatus === "fallback_deterministic") {
    notes.push("Validation notes: deterministic pre-parse was stored because full agent validation was unavailable or incomplete.");
  }

  const errorMessage = asText(job.errorMessage);
  if (job.status === "failed" && errorMessage) {
    notes.push(`Failure note: ${errorMessage}`);
  }

  return notes;
}

function buildCommonHeader(job: FileIqOwnedJob, title: string, schemaType: string, schemaVersion: string): ReportLine[] {
  return [
    { text: title, bold: true, fontSize: 20 },
    { text: `Bundle: ${job.bundleName}`, fontSize: 11 },
    { text: `Job ID: ${job.id}`, fontSize: 10 },
    { text: `Status: ${job.status} | Schema: ${schemaType} v${schemaVersion}`, fontSize: 10 },
    { text: `Submitted: ${formatDate(job.createdAt)} | Completed: ${formatDate(job.completedAt)}`, fontSize: 10 },
    { text: "" },
  ];
}

function buildProductCatalogReport(job: FileIqOwnedJob, payload: Record<string, unknown>): FileIqPdfReport {
  const schemaVersion = asText(payload.schemaVersion) ?? "1.1";
  const supplierName =
    asText(job.summary.supplierName) ??
    asText(isRecord(payload.supplier) ? payload.supplier.name : null) ??
    "Unknown Supplier";
  const products = Array.isArray(payload.products)
    ? payload.products.filter(isRecord)
    : [];
  const categoryCounts = new Map<string, number>();
  const inventoryCounts = new Map<string, number>();
  let missingPriceCount = 0;

  for (const product of products) {
    const category = asText(product.category) ?? "Uncategorized";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

    const inventory = isRecord(product.inventory) ? product.inventory : null;
    const inventoryStatus = asText(inventory?.status) ?? "unknown";
    inventoryCounts.set(inventoryStatus, (inventoryCounts.get(inventoryStatus) ?? 0) + 1);

    const pricing = isRecord(product.pricing) ? product.pricing : null;
    if (asNumber(pricing?.msrp) == null && asNumber(pricing?.wholesaleCost) == null) {
      missingPriceCount += 1;
    }
  }

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => `${category}: ${count}`);
  const topInventory = [...inventoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([status, count]) => `${status}: ${count}`);

  const lines: ReportLine[] = [
    ...buildCommonHeader(job, "FileIQ Product Catalog Report", "product_catalog", schemaVersion),
    { text: "JOB OVERVIEW", bold: true, fontSize: 13 },
    { text: `Supplier: ${supplierName}` },
    { text: `Products extracted: ${products.length}` },
    { text: `Validation: ${asText(job.summary.agentStatus) ?? "unknown"}` },
    { text: "" },
    { text: "SUMMARY TOTALS", bold: true, fontSize: 13 },
    { text: `Distinct categories: ${categoryCounts.size}` },
    { text: `Products missing price fields: ${missingPriceCount}` },
    { text: `Sources processed: ${asNumber(payload.sourcesProcessed) ?? asNumber(job.summary.fileCount) ?? 0}` },
    { text: "" },
    { text: "CATEGORY BREAKDOWN", bold: true, fontSize: 13 },
    ...(topCategories.length > 0 ? topCategories.map((entry) => ({ text: `- ${entry}` })) : [{ text: "- No categories available." }]),
    { text: "" },
    { text: "INVENTORY SNAPSHOT", bold: true, fontSize: 13 },
    ...(topInventory.length > 0 ? topInventory.map((entry) => ({ text: `- ${entry}` })) : [{ text: "- No inventory status data available." }]),
    { text: "" },
    { text: "NOTABLE PATTERNS", bold: true, fontSize: 13 },
    { text: missingPriceCount > 0 ? `- ${missingPriceCount} products are missing MSRP/wholesale pricing.` : "- Pricing coverage is present on every extracted product." },
    { text: products.length > 0 ? `- Largest category cluster: ${topCategories[0] ?? "not available"}.` : "- No products were extracted." },
    { text: "" },
    { text: "VALIDATION AND EXTRACTION NOTES", bold: true, fontSize: 13 },
    ...extractValidationNotes(job, payload).map((note) => ({ text: `- ${note}` })),
  ];

  if (extractValidationNotes(job, payload).length === 0) {
    lines.push({ text: "- No additional validation notes were recorded." });
  }

  return {
    buffer: buildPdfBuffer(lines),
    fileName: `${sanitizeFilePart(job.bundleName)}-product-catalog-report.pdf`,
    title: "FileIQ Product Catalog Report",
    schemaType: "product_catalog",
    schemaVersion,
  };
}

function transactionAmount(transaction: Record<string, unknown>): number | null {
  const direct = asNumber(transaction.amount);
  if (direct != null) return direct;

  const debit = asNumber(transaction.debitAmount);
  const credit = asNumber(transaction.creditAmount);
  if (debit != null || credit != null) {
    return (credit ?? 0) - (debit ?? 0);
  }

  const signed = asNumber(transaction.signedAmount);
  if (signed != null) return signed;
  return null;
}

function transactionCategory(transaction: Record<string, unknown>): string {
  return (
    asText(transaction.category) ??
    asText(transaction.subcategory) ??
    asText(transaction.merchantCategory) ??
    "Uncategorized"
  );
}

function transactionLabel(transaction: Record<string, unknown>): string {
  return (
    asText(transaction.description) ??
    asText(transaction.merchant) ??
    asText(transaction.memo) ??
    "Unknown transaction"
  );
}

function buildFinancialStatementReport(job: FileIqOwnedJob, payload: Record<string, unknown>): FileIqPdfReport {
  const schemaVersion = asText(payload.schemaVersion) ?? "1.0";
  const institution = isRecord(payload.institution) ? payload.institution : null;
  const statementPeriod = isRecord(payload.statementPeriod) ? payload.statementPeriod : null;
  const currency = asText(payload.currency) ?? "USD";
  const transactions = Array.isArray(payload.transactions)
    ? payload.transactions.filter(isRecord)
    : [];

  const spendingByCategory = new Map<string, number>();
  const merchantCounts = new Map<string, number>();
  const notableTransactions: Array<{ label: string; amount: number; date: string | null }> = [];
  let totalIncome = 0;
  let totalSpend = 0;

  for (const transaction of transactions) {
    const amount = transactionAmount(transaction);
    if (amount == null) continue;

    if (amount < 0) {
      totalSpend += Math.abs(amount);
      const category = transactionCategory(transaction);
      spendingByCategory.set(category, (spendingByCategory.get(category) ?? 0) + Math.abs(amount));
    } else {
      totalIncome += amount;
    }

    const merchant = transactionLabel(transaction);
    merchantCounts.set(merchant, (merchantCounts.get(merchant) ?? 0) + 1);
    notableTransactions.push({
      label: merchant,
      amount,
      date: asText(transaction.date),
    });
  }

  const topCategories = [...spendingByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const recurringMerchants = [...merchantCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const largestTransactions = notableTransactions
    .filter((item) => item.amount < 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  const lines: ReportLine[] = [
    ...buildCommonHeader(job, "FileIQ Spending Summary Report", "financial_statement", schemaVersion),
    { text: "JOB OVERVIEW", bold: true, fontSize: 13 },
    { text: `Institution: ${asText(institution?.name) ?? "Unknown"}` },
    { text: `Account: ${asText(institution?.accountType) ?? "Unknown"} ${asText(institution?.accountLast4) ? `ending ${institution?.accountLast4}` : ""}`.trim() },
    { text: `Statements merged: ${asNumber(statementPeriod?.statementCount) ?? asNumber(job.summary.fileCount) ?? 1}` },
    { text: "" },
    { text: "SUMMARY TOTALS", bold: true, fontSize: 13 },
    { text: `Statement period: ${asText(statementPeriod?.startDate) ?? "Unknown"} to ${asText(statementPeriod?.endDate) ?? "Unknown"}` },
    { text: `Transactions extracted: ${transactions.length}` },
    { text: `Total spend: ${formatCurrency(totalSpend, currency)}` },
    { text: `Total income: ${formatCurrency(totalIncome, currency)}` },
    { text: `Net cash flow: ${formatCurrency(totalIncome - totalSpend, currency)}` },
    { text: `Opening balance: ${formatCurrency(asNumber(payload.openingBalance), currency)} | Closing balance: ${formatCurrency(asNumber(payload.closingBalance), currency)}` },
    { text: "" },
    { text: "CATEGORIZED SPENDING", bold: true, fontSize: 13 },
    ...(topCategories.length > 0
      ? topCategories.map(([category, amount]) => ({ text: `- ${category}: ${formatCurrency(amount, currency)}` }))
      : [{ text: "- No categorized spending was extracted." }]),
    { text: "" },
    { text: "NOTABLE TRANSACTIONS OR PATTERNS", bold: true, fontSize: 13 },
    ...(largestTransactions.length > 0
      ? largestTransactions.map((item) => ({
          text: `- ${item.date ?? "Unknown date"} | ${item.label} | ${formatCurrency(item.amount, currency)}`,
        }))
      : [{ text: "- No notable outgoing transactions were identified." }]),
    ...(recurringMerchants.length > 0
      ? recurringMerchants.map(([merchant, count]) => ({
          text: `- Recurring merchant: ${merchant} appeared ${count} times.`,
        }))
      : [{ text: "- No recurring merchant pattern was detected." }]),
    { text: "" },
    { text: "VALIDATION AND EXTRACTION NOTES", bold: true, fontSize: 13 },
  ];

  const notes = extractValidationNotes(job, payload);
  if (notes.length > 0) {
    lines.push(...notes.map((note) => ({ text: `- ${note}` })));
  } else {
    lines.push({ text: "- No additional validation notes were recorded." });
  }

  return {
    buffer: buildPdfBuffer(lines),
    fileName: `${sanitizeFilePart(job.bundleName)}-spending-report.pdf`,
    title: "FileIQ Spending Summary Report",
    schemaType: "financial_statement",
    schemaVersion,
  };
}

export function buildFileIqPdfReport(
  job: FileIqOwnedJob,
  extraction: FileIqStoredArtifact,
): FileIqPdfReport {
  const payload = extraction.payload;
  const schemaType = asText(payload.schemaType);

  if (schemaType === "product_catalog") {
    return buildProductCatalogReport(job, payload);
  }
  if (schemaType === "financial_statement") {
    return buildFinancialStatementReport(job, payload);
  }

  throw new Error("This completed FileIQ job does not have a supported downloadable report yet.");
}
