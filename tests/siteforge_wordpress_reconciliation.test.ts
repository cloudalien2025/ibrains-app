import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildSpec, ConnectionProfile } from "@/lib/siteforge/contracts";
import { executeBuildSpecToWordPress } from "@/lib/siteforge/wordpress/service";

type ExistingPage = {
  id: number;
  slug: string;
  title: string;
  status: string;
  link?: string;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildSpec(pages: Array<{ title: string; slug: string; template?: "landing" | "standard" | "contact" }>): BuildSpec {
  return {
    siteTitle: "Acme",
    homepageSlug: "home",
    menu: pages.map((page) => ({ label: page.title, slug: page.slug })),
    pages: pages.map((page, index) => ({
      pageId: `p_${index + 1}`,
      title: page.title,
      slug: page.slug,
      purpose: `${page.title} purpose`,
      sections: [
        {
          id: `sec_${index + 1}`,
          type: "hero",
          heading: `${page.title} heading`,
          body: `${page.title} body`,
        },
      ],
      metadata: { template: page.template ?? "standard" },
    })),
    metadata: {
      conversionFocus: "high",
      thriveAware: true,
      createdAt: new Date("2026-04-19T00:00:00.000Z").toISOString(),
    },
  };
}

function makeFetchMock(params: { frontPageId: number | null; pages: ExistingPage[] }) {
  let nextCreatedId = 1000;

  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.endsWith("/wp-json/wp/v2/settings")) {
      return jsonResponse({ page_on_front: params.frontPageId });
    }

    if (method === "GET" && url.includes("/wp-json/wp/v2/pages?")) {
      return jsonResponse(
        params.pages.map((page) => ({
          id: page.id,
          slug: page.slug,
          status: page.status,
          link: page.link ?? `https://example.com/${page.slug}`,
          title: { rendered: page.title },
        }))
      );
    }

    if (method === "POST" && /\/wp-json\/wp\/v2\/pages\/\d+$/.test(url)) {
      const targetId = Number(url.match(/(\d+)$/)?.[1] ?? "0");
      const target = params.pages.find((page) => page.id === targetId);
      return jsonResponse({
        id: targetId,
        link: target?.link ?? `https://example.com/${target?.slug ?? `page-${targetId}`}`,
      });
    }

    if (method === "POST" && url.endsWith("/wp-json/wp/v2/pages")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { slug?: string };
      const id = nextCreatedId;
      nextCreatedId += 1;
      return jsonResponse({ id, link: `https://example.com/${body.slug ?? `page-${id}`}` });
    }

    if (method === "POST" && url.endsWith("/wp-json/wp/v2/settings")) {
      return jsonResponse({ ok: true });
    }

    if (method === "POST" && url.endsWith("/wp-json/wp/v2/menus")) {
      return jsonResponse({ id: 77 });
    }

    if (method === "POST" && url.endsWith("/wp-json/wp/v2/menu-items")) {
      return jsonResponse({ id: 1 });
    }

    throw new Error(`Unhandled request: ${method} ${url}`);
  });
}

function postCallsToPages(fetchMock: ReturnType<typeof vi.fn>): Array<{ url: string; body: unknown }> {
  return fetchMock.mock.calls
    .map((call) => {
      const [input, init] = call as [string | URL | Request, RequestInit | undefined];
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      return {
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
    })
    .filter((entry) => entry.method === "POST" && entry.url.endsWith("/wp-json/wp/v2/pages"))
    .map((entry) => ({ url: entry.url, body: entry.body }));
}

const connection: ConnectionProfile = {
  id: "conn_1",
  label: "WP",
  baseUrl: "https://example.com",
  username: "admin",
  appPassword: "pw",
};

const thriveMeta = { enabled: true, appliedMappings: ["home:thrive-homepage-canonical:homepage"], fallbackUsed: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("siteforge wordpress reconciliation", () => {
  it("use_existing reuses canonical front page + contact and creates only missing faq/features", async () => {
    const fetchMock = makeFetchMock({
      frontPageId: 10,
      pages: [
        { id: 10, slug: "welcome", title: "Welcome", status: "publish" },
        { id: 11, slug: "contact", title: "Contact", status: "publish" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const spec = buildSpec([
      { title: "Home", slug: "home", template: "landing" },
      { title: "Contact", slug: "contact", template: "contact" },
      { title: "FAQ", slug: "faq" },
      { title: "Features", slug: "features" },
    ]);

    const result = await executeBuildSpecToWordPress(connection, spec, thriveMeta, "use_existing");

    const home = result.createdPages.find((page) => page.intent === "homepage");
    const contact = result.createdPages.find((page) => page.intent === "contact");
    const faq = result.createdPages.find((page) => page.intent === "faq");
    const features = result.createdPages.find((page) => page.intent === "features");

    expect(home?.status).toBe("updated");
    expect(home?.pageId).toBe(10);
    expect(home?.decision).toBe("reused_existing");

    expect(contact?.status).toBe("updated");
    expect(contact?.pageId).toBe(11);
    expect(contact?.decision).toBe("reused_existing");

    expect(faq?.status).toBe("created");
    expect(features?.status).toBe("created");

    const createdBodies = postCallsToPages(fetchMock).map((entry) => (entry.body as { slug?: string }).slug);
    expect(createdBodies).toEqual(["faq", "features"]);

    expect(result.homepage.reason).toBe("use_existing_front_page_retained");
    expect(result.homepage.pageId).toBe(10);
    expect(result.discovery?.frontPageId).toBe(10);

    expect(result.reconciliation?.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "home", intent: "homepage", decision: "reused_existing", targetPageId: 10 }),
        expect.objectContaining({ slug: "contact", intent: "contact", decision: "reused_existing", targetPageId: 11 }),
        expect.objectContaining({ slug: "faq", intent: "faq", decision: "created_new", targetPageId: null }),
        expect.objectContaining({ slug: "features", intent: "features", decision: "created_new", targetPageId: null }),
      ])
    );
  });

  it("reuses existing about page by intent when present", async () => {
    const fetchMock = makeFetchMock({
      frontPageId: 10,
      pages: [
        { id: 10, slug: "home", title: "Home", status: "publish" },
        { id: 15, slug: "about-us", title: "About Us", status: "publish" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const spec = buildSpec([
      { title: "Home", slug: "home", template: "landing" },
      { title: "About", slug: "about" },
    ]);

    const result = await executeBuildSpecToWordPress(connection, spec, thriveMeta, "use_existing");
    const about = result.createdPages.find((page) => page.intent === "about");

    expect(about?.status).toBe("updated");
    expect(about?.pageId).toBe(15);
    expect(about?.decision).toBe("reused_existing");
    expect(about?.decisionReason).toMatch(/^about_intent_match/);
  });

  it("creates faq/features/pricing when canonical matches are absent", async () => {
    const fetchMock = makeFetchMock({
      frontPageId: 10,
      pages: [{ id: 10, slug: "home", title: "Home", status: "publish" }],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const spec = buildSpec([
      { title: "Home", slug: "home", template: "landing" },
      { title: "FAQ", slug: "faq" },
      { title: "Features", slug: "features" },
      { title: "Pricing", slug: "pricing" },
    ]);

    const result = await executeBuildSpecToWordPress(connection, spec, thriveMeta, "use_existing");

    const createdNew = result.createdPages.filter((page) => page.decision === "created_new");
    expect(createdNew.map((page) => page.intent)).toEqual(expect.arrayContaining(["faq", "features", "pricing"]));
    expect(createdNew).toHaveLength(3);
  });

  it("exposes per-page decision metadata in execution results", async () => {
    const fetchMock = makeFetchMock({
      frontPageId: 10,
      pages: [{ id: 10, slug: "home", title: "Home", status: "publish" }],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const spec = buildSpec([
      { title: "Home", slug: "home", template: "landing" },
      { title: "FAQ", slug: "faq" },
    ]);

    const result = await executeBuildSpecToWordPress(connection, spec, thriveMeta, "use_existing");

    for (const page of result.createdPages) {
      expect(page.intent).toBeDefined();
      expect(page.decision).toMatch(/reused_existing|created_new/);
      expect(page.decisionReason).toBeTruthy();
      if (page.decision === "reused_existing") {
        expect(page.matchedPage?.id).toBeTypeOf("number");
      }
    }
  });

  it("preserves non-reconciliation behavior for draft_only by skipping homepage assignment", async () => {
    const fetchMock = makeFetchMock({
      frontPageId: null,
      pages: [],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const spec = buildSpec([{ title: "Home", slug: "home", template: "landing" }]);

    const result = await executeBuildSpecToWordPress(connection, spec, thriveMeta, "draft_only");

    expect(result.createdPages[0]?.status).toBe("created");
    expect(result.homepage.success).toBe(true);
    expect(result.homepage.reason).toBe("draft_only_skip_assignment");

    const settingsPostCalled = fetchMock.mock.calls.some((call) => {
      const [input, init] = call as [string | URL | Request, RequestInit | undefined];
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return (init?.method ?? "GET").toUpperCase() === "POST" && url.endsWith("/wp-json/wp/v2/settings");
    });
    expect(settingsPostCalled).toBe(false);
  });
});
