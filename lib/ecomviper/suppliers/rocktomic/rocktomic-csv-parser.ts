export interface ParsedCsvResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  rowCount: number;
}

export interface CsvRowProvenance {
  rowIndex: number;
  rawLine: string;
}

/**
 * RFC 4180 compliant CSV parser. Handles:
 * - Quoted fields containing commas
 * - Quoted fields containing embedded newlines (CRLF or LF)
 * - Escaped double-quotes ("" inside quoted fields)
 * - Both CRLF and LF line endings at record boundaries
 *
 * Does NOT split on newlines first (which would break embedded-newline fields).
 */
export function parseRfc4180Csv(csv: string): ParsedCsvResult {
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuote = false;
  let i = 0;
  const n = csv.length;

  while (i < n) {
    const ch = csv[i];

    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < n && csv[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuote = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
        i += 1;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
        i += 1;
      } else if (ch === "\r" && i + 1 < n && csv[i + 1] === "\n") {
        current.push(field.trim());
        field = "";
        records.push(current);
        current = [];
        i += 2;
      } else if (ch === "\n") {
        current.push(field.trim());
        field = "";
        records.push(current);
        current = [];
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field.trim());
    records.push(current);
  }

  const filteredRecords = records.filter((row) => row.some((cell) => cell.length > 0));
  if (filteredRecords.length === 0) return { headers: [], rows: [], rowCount: 0 };

  const headers = filteredRecords[0].map((h) => h.trim());
  const rows = filteredRecords.slice(1).map((rawRow) => {
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = rawRow[j] ?? "";
    }
    return row;
  });

  return { headers, rows, rowCount: rows.length };
}

export function lookupRowBySku(rows: Array<Record<string, string>>, sku: string): { row: Record<string, string>; rowIndex: number } | null {
  const normalizedTarget = normalizeLookupSku(sku);
  const skuColumns = ["SKU", "sku", "Sku", "Product SKU", "Product Code", "Item SKU"];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    for (const col of skuColumns) {
      const candidate = row[col];
      if (candidate !== undefined && normalizeLookupSku(candidate) === normalizedTarget) {
        return { row, rowIndex: i + 2 }; // +2: 1 for header, 1 for 1-based row numbering
      }
    }
  }
  return null;
}

function normalizeLookupSku(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}
