// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductImageGallery from "@/components/ecomviper/product-image-gallery";
import type { OrderedProductImage } from "@/lib/ecomviper/shopify/product-image-ordering";

function image(url: string, type: OrderedProductImage["type"], index: number): OrderedProductImage {
  return {
    id: `${type}-${index}`,
    url,
    altText: `${type}-${index}`,
    type,
    source: "test",
    originalIndex: index,
  };
}

describe("ecomviper product image gallery", () => {
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
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders main image and thumbnails", async () => {
    await act(async () => {
      root.render(
        <ProductImageGallery
          productTitle="Sample"
          images={[
            image("https://example.com/front.png", "front", 0),
            image("https://example.com/facts.png", "facts", 1),
            image("https://example.com/side.png", "side", 2),
          ]}
        />
      );
    });

    expect(container.querySelector('[data-testid="product-image-gallery"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="product-gallery-main-image"] img')?.getAttribute("src")).toBe(
      "https://example.com/front.png"
    );
    expect(container.querySelectorAll('[data-testid="product-gallery-thumbnail"]').length).toBeGreaterThan(0);
  });

  it("updates main image when selecting a thumbnail", async () => {
    await act(async () => {
      root.render(
        <ProductImageGallery
          productTitle="Sample"
          images={[
            image("https://example.com/front.png", "front", 0),
            image("https://example.com/facts.png", "facts", 1),
          ]}
        />
      );
    });

    const secondThumb = container.querySelectorAll("button[aria-label^='Select product image']")[1];
    expect(secondThumb).not.toBeUndefined();

    await act(async () => {
      secondThumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="product-gallery-main-image"] img')?.getAttribute("src")).toBe(
      "https://example.com/facts.png"
    );
    expect(container.querySelector('[data-testid="product-gallery-thumbnail-active"] img')?.getAttribute("src")).toBe(
      "https://example.com/facts.png"
    );
  });

  it("renders safe fallback when no images are available", async () => {
    await act(async () => {
      root.render(<ProductImageGallery productTitle="Sample" images={[]} />);
    });

    expect(container.textContent).toContain("No product images available");
  });

  it("shows add-image controls for upload, url, and image studio", async () => {
    await act(async () => {
      root.render(<ProductImageGallery productTitle="Sample" images={[]} />);
    });

    const addControl = container.querySelector('[data-testid="product-gallery-add-image-control"]');
    expect(addControl).not.toBeNull();
    await act(async () => {
      addControl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="product-gallery-upload-input"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="product-gallery-url-input"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="product-gallery-image-studio-hook"]')).not.toBeNull();
  });

  it("adds a valid https image url through add-image workflow", async () => {
    const onAddImageUrl = vi.fn();
    await act(async () => {
      root.render(<ProductImageGallery productTitle="Sample" images={[]} onAddImageUrl={onAddImageUrl} />);
    });

    const addControl = container.querySelector('[data-testid="product-gallery-add-image-control"]');
    await act(async () => {
      addControl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = container.querySelector('[data-testid="product-gallery-url-input"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(input, "https://cdn.example.com/new-image.webp");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const addUrlButton = container.querySelector('[data-testid="product-gallery-add-url-button"]');
    await act(async () => {
      addUrlButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onAddImageUrl).toHaveBeenCalledWith("https://cdn.example.com/new-image.webp");
    expect(container.querySelector('[data-testid="product-gallery-main-image"] img')?.getAttribute("src")).toBe(
      "https://cdn.example.com/new-image.webp"
    );
  });

  it("handles invalid image URLs safely after load error", async () => {
    await act(async () => {
      root.render(
        <ProductImageGallery
          productTitle="Sample"
          images={[image("https://example.com/broken.png", "front", 0)]}
        />
      );
    });

    const mainImage = container.querySelector('[data-testid="product-gallery-main-image"] img');
    await act(async () => {
      mainImage?.dispatchEvent(new Event("error"));
    });

    expect(container.textContent).toContain("No product images available");
  });
});
