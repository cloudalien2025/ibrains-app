// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductEditorClient from "@/app/apps/ecomviper/walmart/products/[sku]/product-editor-client";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_roc808",
    marketplace: "walmart",
    sku: "ROC808",
    externalItemId: "wm_roc808",
    title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
    brand: "OPA Sleep",
    category: "Supplements",
    price: 29.99,
    inventoryQuantity: 11,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Item Search returned no usable image.",
    imageSyncStatus: "not_found",
    imageSource: "walmart_item_search",
    issues: ["Image not provided by Walmart Item Search"],
    attributes: { form: "gummy" },
    shortDescription: "Current short description",
    longDescription: "Current long description",
    bulletPoints: ["Current bullet one", "Current bullet two", "Current bullet three"],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function flush() {
  return act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setFileInputFiles(element: HTMLInputElement, files: File[]) {
  Object.defineProperty(element, "files", {
    value: files,
    configurable: true,
  });
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Walmart product editor public listing image flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("shows connect prompt for public listing images when SerpApi is not connected", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Public Walmart Listing Images");
    expect(container.textContent).toContain("Images missing");
    expect(container.textContent).toContain(
      "EcomViper could not find images through Walmart Marketplace APIs."
    );
    expect(container.textContent).toContain(
      "SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment."
    );
  });

  it("shows Generate Product Images setup state when OpenAI key is not connected", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Generate Product Images");
    expect(container.textContent).toContain(
      "OpenAI API key not connected. Connect OpenAI to generate product images."
    );
  });

  it("loads with malformed legacy staged drafts and keeps Generate Product Images panel visible", async () => {
    const malformedDraft = {
      id: "legacy_draft_1",
      productId: "walmart_roc808",
      marketplace: "walmart",
      sku: "roc808",
      productTitle: "Legacy Draft",
      draftPayload: {
        generatedMediaAssets: [
          null,
          { id: "bad_asset", url: null, imageType: null },
          {
            id: "good_asset",
            url: "https://app.ibrains.ai/api/ecomviper/walmart/generated-media/ev_wm_img_good",
            previewUrl: "/api/ecomviper/walmart/generated-media/ev_wm_img_good",
            source: "openai_generated",
            imageType: "lifestyle",
            createdAt: "2026-05-10T00:00:00.000Z",
            approved: true,
          },
        ],
        openAiGeneratedImages: null,
      },
      changeSummary: "",
      createdBy: "",
      status: "invalid_status",
      validationResult: null,
      publishStatus: "invalid_publish_status",
      createdAt: null,
      updatedAt: null,
    } as unknown as WalmartDraftRecord;

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[malformedDraft]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Generate Product Images");
    expect(container.textContent).toContain("Legacy draft rows were normalized while loading this editor.");
    expect(container.textContent).toContain("malformed generated-media entries were skipped");
  });

  it("allows attaching and removing reference images before generation", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        this.result =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJUb6f4AAAAASUVORK5CYII=";
        this.onload?.call(this as unknown as FileReader, new ProgressEvent("load"));
      }
    }
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const fileInput = container.querySelector(
      '[data-testid="ecomviper-generated-reference-input"]'
    ) as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      setFileInputFiles(
        fileInput as HTMLInputElement,
        [new File(["abc"], "supplement-label.png", { type: "image/png" })]
      );
    });
    await flush();

    expect(container.textContent).toContain("supplement-label.png");
    const removeReferenceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Remove reference"
    ) as HTMLButtonElement | undefined;
    expect(removeReferenceButton).toBeDefined();
    await act(async () => {
      removeReferenceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).not.toContain("supplement-label.png");
  });

  it("shows actionable validation message when uploaded reference image is too large", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        const hugePayload = "A".repeat(700_000);
        this.result = `data:image/png;base64,${hugePayload}`;
        this.onload?.call(this as unknown as FileReader, new ProgressEvent("load"));
      }
    }
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const fileInput = container.querySelector(
      '[data-testid="ecomviper-generated-reference-input"]'
    ) as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      setFileInputFiles(
        fileInput as HTMLInputElement,
        [new File(["abc"], "large-reference.png", { type: "image/png" })]
      );
    });
    await flush();

    expect(container.textContent).toContain("max per reference is");
    expect(container.textContent).toContain("large-reference.png");
  });

  it("sends uploaded reference images with generate request payload", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        this.result =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJUb6f4AAAAASUVORK5CYII=";
        this.onload?.call(this as unknown as FileReader, new ProgressEvent("load"));
      }
    }
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes("/api/ecomviper/walmart/ai/images/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sku: "ROC808",
              imageType: "supplement_facts",
              generated: [
                {
                  id: "ev_wm_img_ref",
                  url: "https://app.ibrains.ai/api/ecomviper/walmart/generated-media/ev_wm_img_ref",
                  previewUrl: "/api/ecomviper/walmart/generated-media/ev_wm_img_ref",
                  source: "openai_generated",
                  imageType: "supplement_facts",
                  createdAt: "2026-05-10T00:00:00.000Z",
                  approved: false,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const imageTypeSelect = Array.from(container.querySelectorAll("select")).find((entry) =>
      entry.parentElement?.textContent?.includes("Image type")
    ) as HTMLSelectElement | undefined;
    await act(async () => {
      if (imageTypeSelect) {
        imageTypeSelect.value = "supplement_facts";
        imageTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await flush();

    const fileInput = container.querySelector(
      '[data-testid="ecomviper-generated-reference-input"]'
    ) as HTMLInputElement | null;
    await act(async () => {
      setFileInputFiles(
        fileInput as HTMLInputElement,
        [new File(["abc"], "supplement-facts.png", { type: "image/png" })]
      );
    });
    await flush();

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as {
      referenceImages?: Array<{ source?: string; url?: string; mimeType?: string }>;
      imageType?: string;
    };
    expect(body.imageType).toBe("supplement_facts");
    expect(body.referenceImages?.length).toBe(1);
    expect(body.referenceImages?.[0]?.source).toBe("uploaded");
    expect(body.referenceImages?.[0]?.mimeType).toBe("image/png");
    expect(String(body.referenceImages?.[0]?.url ?? "")).toContain("data:image/png;base64,");
  });

  it("shows actionable OpenAI generation error message instead of generic HTTP 400", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/ai/images/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "OPENAI_UNSUPPORTED_SIZE",
                statusCode: 400,
                category: "invalid_request",
                message:
                  "OpenAI rejected the image request: unsupported size for the selected model.",
                recommendation:
                  "Retry generation. If it still fails, check model/size compatibility in OpenAI settings.",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate"
    ) as HTMLButtonElement | undefined;
    expect(generateButton).toBeDefined();
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "OpenAI rejected the image request: unsupported size for the selected model."
    );
    expect(container.textContent).not.toContain("OpenAI image generation failed: HTTP 400.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces actionable message and diagnostics when generation endpoint returns non-JSON 413", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        this.result =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJUb6f4AAAAASUVORK5CYII=";
        this.onload?.call(this as unknown as FileReader, new ProgressEvent("load"));
      }
    }
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes("/api/ecomviper/walmart/ai/images/generate")) {
        return Promise.resolve(
          new Response("Request Entity Too Large", {
            status: 413,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const fileInput = container.querySelector(
      '[data-testid="ecomviper-generated-reference-input"]'
    ) as HTMLInputElement | null;
    await act(async () => {
      setFileInputFiles(
        fileInput as HTMLInputElement,
        [new File(["abc"], "reference.png", { type: "image/png" })]
      );
    });
    await flush();

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "Reference image payload is too large for this request. Upload smaller images and retry."
    );
    expect(container.textContent).toContain("Generation diagnostics");
    expect(container.textContent).toContain("Status: 413");
    expect(container.textContent).toContain("request_body");
  });

  it("uses relative preview URL when generated asset URL is localhost-style absolute", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/ai/images/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sku: "ROC808",
              imageType: "lifestyle",
              generated: [
                {
                  id: "ev_wm_img_localhost",
                  url: "https://localhost:3001/api/ecomviper/walmart/generated-media/ev_wm_img_localhost",
                  previewUrl: "/api/ecomviper/walmart/generated-media/ev_wm_img_localhost",
                  source: "openai_generated",
                  imageType: "lifestyle",
                  createdAt: "2026-05-10T00:00:00.000Z",
                  approved: false,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const previewImage = Array.from(container.querySelectorAll("img")).find((img) =>
      img.getAttribute("alt")?.includes("Lifestyle preview")
    );
    expect(previewImage?.getAttribute("src")).toBe(
      "/api/ecomviper/walmart/generated-media/ev_wm_img_localhost"
    );
  });

  it("generates image preview, approves to product media, and persists generated image metadata in draft", async () => {
    const generatedAssetUrl =
      "https://app.ibrains.ai/api/ecomviper/walmart/generated-media/ev_wm_img_123";

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/ai/images/generate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sku: "ROC808",
              imageType: "lifestyle",
              generated: [
                {
                  id: "ev_wm_img_123",
                  url: generatedAssetUrl,
                  source: "openai_generated",
                  imageType: "lifestyle",
                  createdAt: "2026-05-10T00:00:00.000Z",
                  promptSummary: "Lifestyle image for ROC808",
                  guidance: "bedside table",
                  approved: false,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (url.includes("/api/ecomviper/walmart/drafts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              draft: {
                updatedAt: "2026-05-10T00:00:00.000Z",
                validationResult: {
                  valid: true,
                  violations: [],
                  warnings: [],
                  suggestions: [],
                },
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({ imageUrl: "" })}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const generateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Generate"
    ) as HTMLButtonElement | undefined;
    expect(generateButton).toBeDefined();
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Source: OpenAI generated");
    expect(container.textContent).toContain("Lifestyle");

    const approveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add to Product Media"
    ) as HTMLButtonElement | undefined;
    expect(approveButton).toBeDefined();
    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(
      "Generated image added to product media. Save Draft to persist and include it in Walmart updates."
    );
    const primaryInput = Array.from(container.querySelectorAll("input")).find((entry) =>
      entry.parentElement?.textContent?.includes("Primary image URL")
    ) as HTMLInputElement | undefined;
    expect(primaryInput?.value).toBe(generatedAssetUrl);

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const saveCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(saveCall[0]).toBe("/api/ecomviper/walmart/drafts");
    const saveBody = JSON.parse(String(saveCall[1].body)) as {
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.draftPayload.imageUrl).toBe(generatedAssetUrl);
    expect(saveBody.draftPayload.imageSource).toBe("openai_generated");
    expect(saveBody.draftPayload.generatedMediaAssets).toEqual([
      expect.objectContaining({
        id: "ev_wm_img_123",
        url: generatedAssetUrl,
        source: "openai_generated",
        imageType: "lifestyle",
        approved: true,
      }),
    ]);
  });

  it("finds public listing images, requires explicit Use Images in Draft, and saves draft fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/images/resolve")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sku: "ROC808",
              resolved: {
                imageSyncStatus: "found",
                imageSource: "public_walmart_listing_serpapi",
                imageSourceLabel: "Public Walmart listing via SerpApi",
                imageMatchMethod: "public_url_product_id",
                publicWalmartUrl:
                  "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
                publicWalmartProductId: "18410702298",
                primaryImageUrl: "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
                galleryImageUrls: [
                  "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
                  "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
                ],
                variantImageUrls: [],
                imageCount: 2,
                imageSyncReason: "Public Walmart listing images found via SerpApi.",
                lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (url.includes("/api/ecomviper/walmart/drafts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              draft: {
                updatedAt: "2026-05-10T00:00:00.000Z",
                validationResult: {
                  valid: true,
                  violations: [],
                  warnings: [],
                  suggestions: [],
                },
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct()}
          stagedDrafts={[]}
          aiProviderConnected={true}
          serpApiProviderConnected={true}
        />
      );
    });

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const urlInput = container.querySelector(
      'input[placeholder="https://www.walmart.com/ip/.../18410702298"]'
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(
        urlInput,
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298"
      );
    });

    const findButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Find Images from Public Walmart Listing"
    ) as HTMLButtonElement;

    await act(async () => {
      findButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Public Walmart listing via SerpApi");
    expect(container.textContent).toContain("Public product ID: 18410702298");

    const useButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Use Images in Draft"
    ) as HTMLButtonElement;

    await act(async () => {
      useButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Images added to draft. Save Draft before submitting.");
    expect(container.textContent).not.toContain("Images missing");

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement;

    await act(async () => {
      saveDraftButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [resolveUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(resolveUrl).toBe("/api/ecomviper/walmart/products/ROC808/images/resolve");

    const [saveUrl, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(saveUrl).toBe("/api/ecomviper/walmart/drafts");

    const saveBody = JSON.parse(String(saveInit.body)) as {
      sku: string;
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.sku).toBe("ROC808");
    expect(saveBody.draftPayload.imageUrl).toBe(
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg"
    );
    expect(saveBody.draftPayload.primaryImageUrl).toBe(
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg"
    );
    expect(saveBody.draftPayload.additionalImageUrls).toEqual([
      "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
    ]);
    expect(saveBody.draftPayload.galleryImageUrls).toEqual([
      "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
      "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
    ]);
    expect(saveBody.draftPayload.imageSource).toBe("public_walmart_listing_serpapi");
    expect(saveBody.draftPayload.publicWalmartProductId).toBe("18410702298");
    expect(saveBody.draftPayload.imageMatchMethod).toBe("public_url_product_id");

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/feeds/submit"))).toBe(false);
  });

  it("shows Shopify source labels and preserves Shopify gallery/variant previews from persisted product metadata", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/ecomviper/walmart/drafts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              draft: {
                updatedAt: "2026-05-10T00:00:00.000Z",
                validationResult: {
                  valid: true,
                  violations: [],
                  warnings: [],
                  suggestions: [],
                },
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 500 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const stagedDraft: WalmartDraftRecord = {
      id: "ev_draft_shopify_gallery",
      productId: "walmart_roc808",
      marketplace: "walmart",
      sku: "ROC808",
      productTitle: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
      draftPayload: {
        title: "OPA Sleep Magnesium Glycinate Relaxation Gummies 60ct",
        price: 29.99,
        inventoryQuantity: 11,
        imageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
        additionalImageUrls: [],
      },
      changeSummary: "shopify media draft",
      createdBy: "tester",
      status: "validated",
      validationResult: {
        valid: true,
        warnings: [],
        suggestions: [],
      },
      publishStatus: "pending",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    };

    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            imageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
            primaryImageUrl: "https://cdn.shopify.com/variant-main.jpg?v=1",
            galleryImageUrls: [
              "https://cdn.shopify.com/variant-main.jpg?v=1",
              "https://cdn.shopify.com/gallery-2.jpg?v=2",
              "https://cdn.shopify.com/gallery-3.jpg?v=3",
            ],
            variantImageUrls: ["https://cdn.shopify.com/variant-main.jpg?v=1"],
            imageStatus: "image_available",
            imageStatusMessage: "Image available",
            imageSyncStatus: "found",
            imageSyncReason: "Shopify variant image matched and applied.",
            imageSource: "shopify_variant",
            issues: [],
          })}
          stagedDrafts={[stagedDraft]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    expect(openEditorButton).toBeDefined();
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    expect(mediaTab).toBeDefined();
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Source: Shopify variant image");
    expect(container.textContent).toContain("Gallery images: 3");
    expect(container.textContent).toContain("Variant images: 1");

    const saveDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Draft"
    ) as HTMLButtonElement | undefined;
    expect(saveDraftButton).toBeDefined();
    await act(async () => {
      saveDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const saveCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(saveCall[0]).toBe("/api/ecomviper/walmart/drafts");
    const saveBody = JSON.parse(String(saveCall[1].body)) as {
      draftPayload: Record<string, unknown>;
    };
    expect(saveBody.draftPayload.additionalImageUrls).toEqual([
      "https://cdn.shopify.com/gallery-2.jpg?v=2",
      "https://cdn.shopify.com/gallery-3.jpg?v=3",
    ]);
    expect(saveBody.draftPayload.galleryImageUrls).toEqual([
      "https://cdn.shopify.com/variant-main.jpg?v=1",
      "https://cdn.shopify.com/gallery-2.jpg?v=2",
      "https://cdn.shopify.com/gallery-3.jpg?v=3",
    ]);
  });

  it("shows Shopify one-image diagnostics when no additional gallery media exists", async () => {
    await act(async () => {
      root.render(
        <ProductEditorClient
          product={createProduct({
            imageUrl: "https://cdn.shopify.com/variant-only.jpg?v=1",
            primaryImageUrl: "https://cdn.shopify.com/variant-only.jpg?v=1",
            galleryImageUrls: ["https://cdn.shopify.com/variant-only.jpg?v=1"],
            variantImageUrls: ["https://cdn.shopify.com/variant-only.jpg?v=1"],
            imageStatus: "image_available",
            imageStatusMessage: "Image available",
            imageSyncStatus: "found",
            imageSyncReason: "Shopify variant image matched and applied.",
            imageSource: "shopify_variant",
            issues: [],
          })}
          stagedDrafts={[]}
          aiProviderConnected={false}
          serpApiProviderConnected={false}
        />
      );
    });

    const openEditorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Open Draft Editor"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      openEditorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const mediaTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Media"
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      mediaTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Source: Shopify variant image");
    expect(container.textContent).toContain("Imported Shopify media images: 1");
    expect(container.textContent).toContain(
      "Reason additional images are blank: Shopify returned no additional attached product media."
    );
  });
});
