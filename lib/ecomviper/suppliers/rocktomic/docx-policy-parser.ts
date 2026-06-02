export interface PolicySection {
  title: string | null;
  content: string;
}

export interface DocxPolicyParseResult {
  parsed: boolean;
  sourceUrl: string | null;
  sections: PolicySection[];
  fullText: string | null;
  normalizedSummary: string | null;
  warnings: string[];
  parserUsed: string | null;
}

async function tryParseMammoth(docxBuffer: Buffer): Promise<{ text: string; warnings: string[] } | null> {
  try {
    // Use Function constructor to avoid TypeScript's static module resolution check on this optional peer dep
    const dynamicImport = new Function("moduleName", "return import(moduleName)");
    const mammoth = await dynamicImport("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: Array<{ message: string }> }> };
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    return { text: result.value, warnings: result.messages.map((m) => m.message) };
  } catch {
    return null;
  }
}

function splitIntoSections(text: string): PolicySection[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: PolicySection[] = [];
  let currentTitle: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.length < 80 && /^[A-Z]/.test(line) && !line.includes(".") && currentContent.length > 0) {
      sections.push({ title: currentTitle, content: currentContent.join(" ") });
      currentTitle = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join(" ") });
  }
  return sections;
}

function buildNormalizedSummary(sections: PolicySection[]): string {
  return sections
    .slice(0, 5)
    .map((s) => (s.title ? `${s.title}: ${s.content.slice(0, 200)}` : s.content.slice(0, 200)))
    .join(" | ");
}

export async function parseDocxPolicy(input: {
  docxBuffer?: Buffer | null;
  sourceUrl?: string | null;
  localPath?: string | null;
}): Promise<DocxPolicyParseResult> {
  const sourceUrl = input.sourceUrl ?? null;
  const warnings: string[] = [];

  let docxBuffer: Buffer | null = input.docxBuffer ?? null;

  if (!docxBuffer && input.localPath) {
    try {
      const { readFile } = await import("node:fs/promises");
      docxBuffer = Buffer.from(await readFile(input.localPath));
    } catch {
      warnings.push("docx_local_file_read_failed");
    }
  }

  if (!docxBuffer) {
    return {
      parsed: false,
      sourceUrl,
      sections: [],
      fullText: null,
      normalizedSummary: null,
      warnings: [...warnings, "docx_buffer_unavailable"],
      parserUsed: null,
    };
  }

  const mammothResult = await tryParseMammoth(docxBuffer);
  if (!mammothResult) {
    return {
      parsed: false,
      sourceUrl,
      sections: [],
      fullText: null,
      normalizedSummary: null,
      warnings: [...warnings, "docx_parser_unavailable: mammoth not installed; install mammoth to enable DOCX parsing"],
      parserUsed: null,
    };
  }

  warnings.push(...mammothResult.warnings);
  const sections = splitIntoSections(mammothResult.text);
  const normalizedSummary = sections.length > 0 ? buildNormalizedSummary(sections) : null;

  return {
    parsed: true,
    sourceUrl,
    sections,
    fullText: mammothResult.text,
    normalizedSummary,
    warnings,
    parserUsed: "mammoth",
  };
}
