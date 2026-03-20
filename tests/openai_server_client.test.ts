import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorityRouteError } from "@/app/api/directoryiq/_utils/authorityErrors";
import { generateAuthorityDraft, generateAuthorityImage, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("openai server client", () => {
  it("maps auth failures to OPENAI_AUTH", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    ) as typeof fetch;

    await expect(generateAuthorityDraft({ apiKey: "bad", prompt: "test" })).rejects.toMatchObject({
      code: "OPENAI_AUTH",
    } satisfies Partial<AuthorityRouteError>);
  });

  it("returns image data url when b64 payload exists", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ b64_json: "abc" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    global.fetch = fetchMock as typeof fetch;

    const image = await generateAuthorityImage({ apiKey: "good", prompt: "hero" });
    expect(image).toBe("data:image/png;base64,abc");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const payload = JSON.parse(String(request?.body ?? "{}")) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("response_format");
    expect(payload.model).toBe("gpt-image-1");
    expect(payload.prompt).toBe("hero");
  });

  it("keeps non-image draft request behavior unchanged", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "draft output" } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    const draft = await generateAuthorityDraft({ apiKey: "good", prompt: "write draft" });
    expect(draft).toBe("draft output");

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body ?? "{}")) as Record<string, unknown>;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(payload.temperature).toBe(0.2);
    expect(payload).toHaveProperty("messages");
  });

  it("throws when openai key missing", () => {
    expect(() => validateOpenAiKeyPresent(null)).toThrowError("OpenAI API not configured");
  });
});
