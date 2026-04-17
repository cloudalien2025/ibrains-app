type StructuredJsonRequest = {
  apiKey: string;
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
  maxOutputTokens?: number;
};

function extractTextPayload(response: Record<string, unknown>): string {
  const outputText = response.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const contentRecord = contentItem as Record<string, unknown>;
      const text = contentRecord.text;
      if (typeof text === "string" && text.trim()) {
        return text;
      }
    }
  }

  throw new Error("Model did not return text output.");
}

async function singleAttempt<T>(request: StructuredJsonRequest, strictHint: string): Promise<T> {
  const body = {
    model: request.model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: request.system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: `${request.user}\n\n${strictHint}` }],
      },
    ],
    max_output_tokens: request.maxOutputTokens ?? 2800,
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        schema: request.schema,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 280)}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const textPayload = extractTextPayload(json);

  try {
    return JSON.parse(textPayload) as T;
  } catch {
    throw new Error("Model returned invalid JSON.");
  }
}

export async function generateStructuredJson<T>(request: StructuredJsonRequest): Promise<T> {
  const strictHints = [
    "Return only strict JSON that matches the schema exactly.",
    "Retry requirement: output must be valid JSON schema output with no markdown or prose.",
    "Final retry: emit a single JSON object that exactly matches the schema; no extra keys.",
  ];

  let lastError: unknown = null;
  for (const hint of strictHints) {
    try {
      return await singleAttempt<T>(request, hint);
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "OpenAI structured generation failed.");
}
