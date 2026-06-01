import { normalizeSku } from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

export interface ParsedCsvTable {
  headers: string[];
  rows: Array<Record<string, string>>;
}

function extractSpreadsheetId(input: string): string {
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input)) return input;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (!match?.[1]) throw new Error("invalid_google_sheet_id_or_url");
  return match[1];
}

export function buildGoogleSheetsCsvExportUrl(input: {
  spreadsheetIdOrUrl: string;
  gid?: string | number | null;
}): string {
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetIdOrUrl);
  const gid = input.gid == null ? null : String(input.gid).trim();
  const gidQuery = gid ? `&gid=${encodeURIComponent(gid)}` : "";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidQuery}`;
}

export async function fetchGoogleSheetsCsv(input: {
  spreadsheetIdOrUrl: string;
  gid?: string | number | null;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = input.fetchImpl || fetch;
  const url = buildGoogleSheetsCsvExportUrl({
    spreadsheetIdOrUrl: input.spreadsheetIdOrUrl,
    gid: input.gid,
  });

  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
  });

  if (!response.ok) {
    throw new Error(`google_sheet_csv_fetch_failed:${response.status}`);
  }

  return await response.text();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvTable(csv: string): ParsedCsvTable {
  const lines = csv
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });

  return { headers, rows };
}

export function findCsvRowBySku(input: {
  rows: Array<Record<string, string>>;
  sku: string;
}): Record<string, string> | null {
  const targetSku = normalizeSku(input.sku);
  for (const row of input.rows) {
    const skuCandidate =
      row.SKU
      || row.sku
      || row.Sku
      || row["Product SKU"]
      || row["Product Code"]
      || "";
    if (normalizeSku(skuCandidate) === targetSku) return row;
  }
  return null;
}
