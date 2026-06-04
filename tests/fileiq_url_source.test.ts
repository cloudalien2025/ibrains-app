import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  scrape: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mocks.query,
}));

vi.mock("@/lib/ecomviper/suppliers/firecrawl/firecrawl-client", () => ({
  FirecrawlClient: function FirecrawlClient() {
    return { scrape: mocks.scrape };
  },
}));

function sdkResult(result: string) {
  return (async function* () {
    yield {
      type: "result",
      subtype: "success",
      result,
      session_id: "sess_url",
      num_turns: 1,
      total_cost_usd: 0.001,
    };
  })();
}

function longMarkdown(seed = "Readable supplier content. "): string {
  return `# Catalog\n\n${seed.repeat(40)}`;
}

import { fetchUrl } from "@/lib/fileiq/sources/url-source";

const priorAnthropic = process.env.ANTHROPIC_API_KEY;
const priorFirecrawl = process.env.FIRECRAWL_API_KEY;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ANTHROPIC_API_KEY = "anthropic-test";
  process.env.FIRECRAWL_API_KEY = "firecrawl-test";
});

afterEach(() => {
  if (priorAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = priorAnthropic;
  if (priorFirecrawl === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = priorFirecrawl;
});

describe("fetchUrl", () => {
  it("uses SDK result when it passes quality check and never calls Firecrawl", async () => {
    const markdown = longMarkdown();
    mocks.query.mockReturnValue(
      sdkResult(JSON.stringify({ title: "SDK Catalog", sourceUrl: "https://example.com/catalog", markdown })),
    );

    const result = await fetchUrl("https://example.com/catalog");

    expect(result.method).toBe("sdk");
    expect(result.markdown).toBe(markdown.trim());
    expect(result.title).toBe("SDK Catalog");
    expect(mocks.scrape).not.toHaveBeenCalled();
  });

  it("falls back to Firecrawl when SDK content fails quality check", async () => {
    mocks.query.mockReturnValue(
      sdkResult(JSON.stringify({ title: "Shell", sourceUrl: "https://example.com/catalog", markdown: "<html><body><div id=\"root\"></div></body></html>" })),
    );
    mocks.scrape.mockResolvedValue({
      source: "live",
      url: "https://example.com/catalog",
      markdown: longMarkdown("Firecrawl readable content. "),
      html: null,
      json: null,
      metadata: { title: "Firecrawl Catalog" },
      fetchedAt: "2026-06-04T12:00:00.000Z",
    });

    const result = await fetchUrl("https://example.com/catalog");

    expect(result.method).toBe("firecrawl");
    expect(result.title).toBe("Firecrawl Catalog");
    expect(result.scrapedAt).toBe("2026-06-04T12:00:00.000Z");
    expect(mocks.scrape).toHaveBeenCalledTimes(1);
  });

  it("logs the selected fetch method for SDK and Firecrawl paths", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mocks.query.mockReturnValueOnce(
      sdkResult(JSON.stringify({ title: "SDK", sourceUrl: "https://example.com/a", markdown: longMarkdown() })),
    );
    await fetchUrl("https://example.com/a");

    mocks.query.mockReturnValueOnce(
      sdkResult(JSON.stringify({ title: "Short", sourceUrl: "https://example.com/b", markdown: "too short" })),
    );
    mocks.scrape.mockResolvedValueOnce({
      source: "live",
      url: "https://example.com/b",
      markdown: longMarkdown("Fallback content. "),
      html: null,
      json: null,
      metadata: { title: "Fallback" },
      fetchedAt: "2026-06-04T12:00:00.000Z",
    });
    await fetchUrl("https://example.com/b");

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("method=sdk"))).toBe(true);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("method=firecrawl"))).toBe(true);
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("falling back to Firecrawl"))).toBe(true);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("does not require FIRECRAWL_API_KEY when SDK quality passes", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    mocks.query.mockReturnValue(
      sdkResult(JSON.stringify({ title: "SDK", sourceUrl: "https://example.com/catalog", markdown: longMarkdown() })),
    );

    await expect(fetchUrl("https://example.com/catalog")).resolves.toMatchObject({ method: "sdk" });
    expect(mocks.scrape).not.toHaveBeenCalled();
  });

  it("errors clearly when fallback is needed and FIRECRAWL_API_KEY is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    mocks.query.mockReturnValue(
      sdkResult(JSON.stringify({ title: "Short", sourceUrl: "https://example.com/catalog", markdown: "too short" })),
    );

    await expect(fetchUrl("https://example.com/catalog")).rejects.toThrow(
      "Firecrawl fallback needed but FIRECRAWL_API_KEY not set",
    );
    expect(mocks.scrape).not.toHaveBeenCalled();
  });
});
