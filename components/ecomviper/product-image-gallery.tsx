"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderedProductImage } from "@/lib/ecomviper/shopify/product-image-ordering";

interface ProductImageGalleryProps {
  images: OrderedProductImage[];
  productTitle: string;
}

export default function ProductImageGallery({ images, productTitle }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedIndex(0);
    setFailedUrls({});
  }, [images]);

  const selectableImages = useMemo(
    () => images.filter((image) => !failedUrls[image.url]),
    [failedUrls, images]
  );

  const selectedImage = selectableImages[selectedIndex] ?? selectableImages[0] ?? null;

  if (!selectableImages.length) {
    return (
      <section
        className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm"
        data-testid="product-image-gallery"
      >
        <h2 className="text-sm font-semibold text-[#0F172A]">Product Gallery</h2>
        <div className="mt-3 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-[#C7D5E8] bg-[#F8FBFF] px-4 text-center text-sm text-[#475569]">
          No product images available
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm"
      data-testid="product-image-gallery"
    >
      <h2 className="text-sm font-semibold text-[#0F172A]">Product Gallery</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-[#D5E2F0] bg-[#F6FAFF]">
        <div className="relative grid aspect-[4/3] place-items-center p-3 sm:p-4" data-testid="product-gallery-main-image">
          {selectedImage ? (
            <img
              src={selectedImage.url}
              alt={selectedImage.altText || productTitle}
              className="h-full w-full object-contain"
              loading="eager"
              onError={() => {
                setFailedUrls((current) => ({ ...current, [selectedImage.url]: true }));
              }}
            />
          ) : (
            <p className="text-sm text-[#475569]">No product images available</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="product-gallery-thumbnails">
        {selectableImages.slice(0, 12).map((image, index) => {
          const active = selectedImage?.url === image.url;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Select product image ${index + 1}`}
              className={`overflow-hidden rounded-lg border bg-[#F8FBFF] p-1 transition ${
                active ? "border-[#1D4ED8] ring-2 ring-[#BFDBFE]" : "border-[#D5E2F0] hover:border-[#93C5FD]"
              }`}
              data-testid={active ? "product-gallery-thumbnail-active" : "product-gallery-thumbnail"}
            >
              <span className="grid aspect-square place-items-center">
                <img
                  src={image.url}
                  alt={image.altText || `${productTitle} thumbnail ${index + 1}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  onError={() => {
                    setFailedUrls((current) => ({ ...current, [image.url]: true }));
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
