import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function createProduct(overrides?: Partial<WalmartProductRecord>): WalmartProductRecord {
  return {
    id: "walmart_sku-30066-841",
    marketplace: "walmart",
    sku: "SKU 30066/841",
    externalItemId: "wm_sku-30066-841",
    title: "Walmart Product",
    brand: "Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 9,
    inventoryStatus: "known",
    status: "attention",
    imageUrl: "",
    issues: ["Image not provided by Walmart catalog"],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    rawPayload: {},
    normalizedPayload: {},
    lastSyncedAt: "2026-05-09T10:00:00.000Z",
    createdAt: "2026-05-09T10:00:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("Walmart products client UX", () => {
  it("links SKU and title to the product editor route with encoded SKU", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain('href="/apps/ecomviper/walmart/products/SKU%2030066%2F841"');
    expect(html).toContain(">SKU 30066/841<");
    expect(html).toContain(">Walmart Product<");
  });

  it("shows clearer image issue copy for missing Walmart catalog images", () => {
    const html = renderToStaticMarkup(<WalmartProductsClient products={[createProduct()]} />);

    expect(html).toContain("Image not provided by Walmart catalog");
    expect(html).not.toContain("Missing image");
  });
});
