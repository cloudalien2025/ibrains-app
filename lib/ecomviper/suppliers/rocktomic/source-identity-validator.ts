export type SourceFileType = "pdf" | "html" | "docx" | "google_sheet" | "csv" | "xlsx" | "unknown";

export interface SourceIdentityEntry {
  id: string;
  label: string;
  url: string;
  detectedType: SourceFileType;
  detectedTitle: string | null;
  detectedRoles: string[];
  warnings: string[];
}

export interface SourceIdentityReport {
  generatedAt: string;
  supplierManifestVersion: number;
  sources: SourceIdentityEntry[];
  duplicateUrlWarnings: Array<{ url: string; assignedLabels: string[] }>;
  duplicateSheetIdWarnings: Array<{ sheetId: string; assignedLabels: string[] }>;
  mislabelWarnings: Array<{ id: string; assignedLabel: string; detectedType: string; details: string }>;
  overallValid: boolean;
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function detectTypeFromUrl(url: string): SourceFileType {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (url.includes("docs.google.com/spreadsheets")) return "google_sheet";
  return "unknown";
}

function detectRoles(id: string, url: string, detectedType: SourceFileType): string[] {
  const roles: string[] = [];
  if (detectedType === "pdf") roles.push("catalog_pdf");
  if (detectedType === "html" && url.includes("templates")) roles.push("templates_html");
  if (detectedType === "docx" && url.toLowerCase().includes("policy")) roles.push("policy_docx");
  if (detectedType === "google_sheet") {
    if (id.includes("msrp") || id.includes("profit") || id.includes("margin")) roles.push("msrp_report_sheet");
    if (id.includes("plds") || id.includes("catalog")) roles.push("plds_catalog_sheet");
    if (id.includes("inventory")) roles.push("inventory_report_sheet");
    if (roles.length === 0) roles.push("unknown_sheet");
  }
  return roles;
}

function detectTitle(id: string, url: string): string | null {
  const sheetId = extractSheetId(url);
  if (sheetId) return `Google Spreadsheet (id=${sheetId})`;
  const filename = url.split("?")[0].split("/").pop();
  if (filename) return decodeURIComponent(filename);
  return null;
}

interface ManifestSource {
  id: string;
  name: string;
  url: string;
  type: string;
}

export function validateSourceIdentity(input: {
  sources: ManifestSource[];
  manifestVersion?: number;
}): SourceIdentityReport {
  const entries: SourceIdentityEntry[] = [];
  const urlToLabels = new Map<string, string[]>();
  const sheetIdToLabels = new Map<string, string[]>();
  const mislabelWarnings: Array<{ id: string; assignedLabel: string; detectedType: string; details: string }> = [];

  for (const source of input.sources) {
    const detectedType = detectTypeFromUrl(source.url);
    const detectedTitle = detectTitle(source.id, source.url);
    const detectedRoles = detectRoles(source.id, source.url, detectedType);
    const warnings: string[] = [];

    const normalizedUrl = source.url.split("?")[0].toLowerCase();
    const existing = urlToLabels.get(normalizedUrl) ?? [];
    existing.push(source.name);
    urlToLabels.set(normalizedUrl, existing);

    const sheetId = extractSheetId(source.url);
    if (sheetId) {
      const existingSheets = sheetIdToLabels.get(sheetId) ?? [];
      existingSheets.push(source.name);
      sheetIdToLabels.set(sheetId, existingSheets);
    }

    const declaredType = source.type?.toLowerCase();
    const typeMismatch = declaredType && declaredType !== "unknown" && detectedType !== declaredType;
    if (typeMismatch) {
      const details = `Source declared type="${source.type}" but URL suggests type="${detectedType}".`;
      warnings.push(`type_mismatch: ${details}`);
      mislabelWarnings.push({ id: source.id, assignedLabel: source.name, detectedType, details });
    }

    if (
      source.name.toLowerCase().includes("supplement") && source.name.toLowerCase().includes("apparel") && source.name.toLowerCase().includes("catalog")
      && detectedType === "google_sheet"
    ) {
      const details = `Label says "Supplement & Apparel Catalog" (expected PDF) but URL is a Google Sheet.`;
      warnings.push(`catalog_label_points_to_sheet: ${details}`);
      mislabelWarnings.push({ id: source.id, assignedLabel: source.name, detectedType, details });
    }

    entries.push({ id: source.id, label: source.name, url: source.url, detectedType, detectedTitle, detectedRoles, warnings });
  }

  const duplicateUrlWarnings: Array<{ url: string; assignedLabels: string[] }> = [];
  for (const [url, labels] of urlToLabels.entries()) {
    if (labels.length > 1) {
      duplicateUrlWarnings.push({ url, assignedLabels: labels });
    }
  }

  const duplicateSheetIdWarnings: Array<{ sheetId: string; assignedLabels: string[] }> = [];
  for (const [sheetId, labels] of sheetIdToLabels.entries()) {
    if (labels.length > 1) {
      duplicateSheetIdWarnings.push({ sheetId, assignedLabels: labels });
    }
  }

  const overallValid =
    mislabelWarnings.length === 0 && duplicateUrlWarnings.length === 0 && duplicateSheetIdWarnings.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    supplierManifestVersion: input.manifestVersion ?? 0,
    sources: entries,
    duplicateUrlWarnings,
    duplicateSheetIdWarnings,
    mislabelWarnings,
    overallValid,
  };
}
