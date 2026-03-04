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
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ b64_json: "abc" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as typeof fetch;

    const image = await generateAuthorityImage({ apiKey: "good", prompt: "hero" });
    expect(image).toBe("data:image/png;base64,abc");
  });

  it("throws when openai key missing", () => {
    expect(() => validateOpenAiKeyPresent(null)).toThrowError("OpenAI API not configured");
  });
});
