import { AuthorityRouteError } from "@/app/api/directoryiq/_utils/authorityErrors";

type JsonObject = Record<string, unknown>;

type OpenAiRequestParams = {
  apiKey: string;
  path: string;
  payload: JsonObject;
  timeoutMs: number;
  retries: number;
};

function redact(text: string): string {
  return text.length > 320 ? `${text.slice(0, 320)}...` : text;
}

async function openAiJsonRequest(params: OpenAiRequestParams): Promise<JsonObject> {
  const url = `https://api.openai.com${params.path}`;
  let attempt = 0;

  while (attempt <= params.retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.payload),
        cache: "no-store",
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as JsonObject | null;
      if (response.ok && json) return json;

      const apiMessage =
        (json?.error as { message?: string } | undefined)?.message ||
        `OpenAI request failed with status ${response.status}.`;

      if (response.status === 401 || response.status === 403) {
        throw new AuthorityRouteError(401, "OPENAI_AUTH", "OpenAI authentication failed.", redact(apiMessage));
      }
      if (response.status === 429) {
        if (attempt < params.retries) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          attempt += 1;
          continue;
        }
        throw new AuthorityRouteError(429, "OPENAI_RATE_LIMIT", "OpenAI rate limit reached.", redact(apiMessage));
      }
      if (response.status >= 500 && attempt < params.retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        attempt += 1;
        continue;
      }
      throw new AuthorityRouteError(502, "OPENAI_UPSTREAM", "OpenAI request failed.", redact(apiMessage));
    } catch (error) {
      if (error instanceof AuthorityRouteError) throw error;
      if (controller.signal.aborted) {
        if (attempt < params.retries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          attempt += 1;
          continue;
        }
        throw new AuthorityRouteError(504, "OPENAI_TIMEOUT", "OpenAI request timed out.");
      }
      if (attempt < params.retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        attempt += 1;
        continue;
      }
      throw new AuthorityRouteError(502, "OPENAI_UPSTREAM", "OpenAI request failed.");
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AuthorityRouteError(502, "OPENAI_UPSTREAM", "OpenAI request failed after retries.");
}

export async function generateAuthorityDraft(params: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  const json = await openAiJsonRequest({
    apiKey: params.apiKey,
    path: "/v1/chat/completions",
    timeoutMs: 45_000,
    retries: 2,
    payload: {
      model: params.model || process.env.DIRECTORYIQ_OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a strict editorial assistant. Follow governance rules and never fabricate facts.",
        },
        { role: "user", content: params.prompt },
      ],
    },
  });

  const content =
    (((json.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content as string | undefined) || "").trim();

  if (!content) {
    throw new AuthorityRouteError(502, "OPENAI_EMPTY_RESPONSE", "OpenAI returned empty draft content.");
  }
  return content;
}

export async function generateAuthorityImage(params: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  const json = await openAiJsonRequest({
    apiKey: params.apiKey,
    path: "/v1/images/generations",
    timeoutMs: 60_000,
    retries: 2,
    payload: {
      model: params.model || process.env.DIRECTORYIQ_OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: params.prompt,
      size: "1536x1024",
      quality: "medium",
      response_format: "b64_json",
    },
  });

  const first = (json.data as Array<{ b64_json?: string; url?: string }> | undefined)?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new AuthorityRouteError(502, "OPENAI_EMPTY_RESPONSE", "OpenAI image generation returned no image payload.");
}

let loggedMissingKey = false;

export function validateOpenAiKeyPresent(apiKey: string | null): string {
  if (apiKey && apiKey.trim().length > 0) return apiKey;
  if (!loggedMissingKey) {
    loggedMissingKey = true;
    console.warn("[authority-support] OpenAI API key missing for DirectoryIQ authority support routes.");
  }
  throw new AuthorityRouteError(
    400,
    "OPENAI_KEY_MISSING",
    "OpenAI API key is not configured in Signal Sources or OPENAI_API_KEY."
  );
}
