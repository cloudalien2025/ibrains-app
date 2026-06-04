export type ParseLocalizedNumberOptions = {
  integer?: boolean;
};

function sanitizeNumericInput(value: string): { sign: "-" | ""; numeric: string } {
  const normalized = value
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[’'`´]/g, "")
    .replace(/\s+/g, "");

  const matches = Array.from(normalized.matchAll(/-?\d[\d.,]*/g));
  if (matches.length === 0) {
    return {
      sign: "",
      numeric: "",
    };
  }

  let bestToken = matches[0]![0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const match of matches) {
    const token = match[0];
    const index = match.index || 0;
    const digits = token.replace(/[^\d]/g, "").length;
    const before = normalized.slice(Math.max(0, index - 6), index).toLowerCase();
    const after = normalized.slice(index + token.length, index + token.length + 6).toLowerCase();
    const score =
      digits +
      (/[.,]/.test(token) ? 2 : 0) +
      (/(?:€|eur|usd|\$)$/.test(before) ? 6 : 0) +
      (/^(?:m2|m²|sqm|sq\.?m|mq)/.test(after) ? 3 : 0) +
      (digits === 1 ? -1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestToken = token;
    }
  }

  const sign: "-" | "" = bestToken.startsWith("-") ? "-" : "";
  const numeric = bestToken.replace(/^-/, "").replace(/[^\d.,]/g, "").replace(/[.,]+$/g, "");

  if (!numeric) {
    return {
      sign: "",
      numeric: "",
    };
  }

  return {
    sign,
    numeric,
  };
}

function normalizeSingleSeparatorNumeric(raw: string, separator: "," | "."): string {
  const parts = raw.split(separator);
  if (parts.length <= 1) return raw;

  if (parts.length > 2) {
    const last = parts[parts.length - 1] || "";
    if (last.length > 0 && last.length <= 2) {
      return `${parts.slice(0, -1).join("")}.${last}`;
    }
    return parts.join("");
  }

  const [left, right] = parts as [string, string];
  if (!right) return left;

  if (right.length <= 2) {
    return `${left}.${right}`;
  }

  if (right.length === 3) {
    return `${left}${right}`;
  }

  return `${left}${right}`;
}

function normalizeMixedSeparatorNumeric(raw: string): string {
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const decimalIndex = raw.lastIndexOf(decimalSeparator);
  const digitsAfter = decimalIndex >= 0 ? raw.length - decimalIndex - 1 : 0;

  if (digitsAfter > 0 && digitsAfter <= 2) {
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const withoutThousands = raw.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") {
      return withoutThousands.replace(",", ".");
    }
    return withoutThousands;
  }

  return raw.replace(/[.,]/g, "");
}

export function parseLocalizedNumber(
  value: unknown,
  options: ParseLocalizedNumberOptions = {},
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return options.integer ? Math.round(value) : value;
  }
  if (typeof value !== "string") return undefined;

  const { sign, numeric } = sanitizeNumericInput(value);
  if (!numeric || !/\d/.test(numeric)) return undefined;

  const commaCount = (numeric.match(/,/g) || []).length;
  const dotCount = (numeric.match(/\./g) || []).length;

  let normalized = numeric;
  if (commaCount > 0 && dotCount > 0) {
    normalized = normalizeMixedSeparatorNumeric(numeric);
  } else if (commaCount > 0) {
    normalized = normalizeSingleSeparatorNumeric(numeric, ",");
  } else if (dotCount > 0) {
    normalized = normalizeSingleSeparatorNumeric(numeric, ".");
  }

  const parsed = Number(`${sign}${normalized}`);
  if (!Number.isFinite(parsed)) return undefined;
  return options.integer ? Math.round(parsed) : parsed;
}

export function parseRealEstatePrice(value: unknown): number | undefined {
  const parsed = parseLocalizedNumber(value, { integer: true });
  if (parsed === undefined) return undefined;
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}
