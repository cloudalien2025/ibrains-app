"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import type { OrderedProductImage } from "@/lib/ecomviper/shopify/product-image-ordering";

interface ProductImageGalleryProps {
  images: OrderedProductImage[];
  productTitle: string;
  onAddImageUrl?: (url: string) => void;
}

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function looksLikeSupportedImageUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized.startsWith("https://")) return false;
  if (/(\.png|\.jpe?g|\.webp|\.gif|\.avif|\.svg)(\?.*)?$/.test(normalized)) return true;
  if (/\/generated-media\//.test(normalized)) return true;
  return false;
}

function dedupeByUrl(images: OrderedProductImage[]): OrderedProductImage[] {
  const seen = new Set<string>();
  const result: OrderedProductImage[] = [];
  for (const image of images) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    result.push(image);
  }
  return result;
}

export default function ProductImageGallery({ images, productTitle, onAddImageUrl }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<OrderedProductImage[]>([]);

  useEffect(() => {
    setFailedUrls({});
  }, [images]);

  useEffect(
    () => () => {
      localImages.forEach((image) => {
        if (image.source === "local-upload" && image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
    },
    [localImages]
  );

  const allImages = useMemo(() => dedupeByUrl([...images, ...localImages]), [images, localImages]);

  const selectableImages = useMemo(
    () => allImages.filter((image) => !failedUrls[image.url]),
    [allImages, failedUrls]
  );

  const selectedImage = selectableImages[selectedIndex] ?? selectableImages[0] ?? null;

  useEffect(() => {
    if (selectedIndex >= selectableImages.length) {
      setSelectedIndex(0);
    }
  }, [selectableImages.length, selectedIndex]);

  function appendLocalImage(input: { url: string; altText: string; source: string }) {
    setLocalImages((current) => {
      if (current.some((image) => image.url === input.url)) return current;
      return [
        ...current,
        {
          id: `${input.source}-${Date.now()}-${input.url}`,
          url: input.url,
          altText: input.altText,
          type: "other",
          source: input.source,
          originalIndex: images.length + current.length,
        },
      ];
    });
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_UPLOAD_TYPES.has(file.type)) {
      setAddMessage("Upload failed: only JPG, PNG, or WEBP files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setAddMessage("Upload failed: file must be 8MB or less.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    appendLocalImage({
      url: objectUrl,
      altText: file.name || `${productTitle} upload`,
      source: "local-upload",
    });
    setAddMessage("Image added for local preview. Upload persistence will be wired with the media backend.");
    event.target.value = "";
  }

  function handleAddUrl() {
    const url = pendingUrl.trim();
    if (!looksLikeSupportedImageUrl(url)) {
      setAddMessage("Please enter a valid https image URL.");
      return;
    }

    appendLocalImage({
      url,
      altText: `${productTitle} added image`,
      source: "merchant-url",
    });
    onAddImageUrl?.(url);
    setPendingUrl("");
    setAddMessage("Image URL added to the gallery preview.");
  }

  return (
    <section
      className="rounded-2xl border border-[#D5E2F0] bg-white p-4 shadow-sm"
      data-testid="product-image-gallery"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#0F172A]">Product Gallery</h2>
        <button
          type="button"
          className="rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#1E40AF]"
          onClick={() => setShowAddPanel((current) => !current)}
          data-testid="product-gallery-add-image-control"
        >
          + Add image
        </button>
      </div>
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
        <button
          type="button"
          onClick={() => setShowAddPanel((current) => !current)}
          className="grid aspect-square place-items-center rounded-lg border border-dashed border-[#93C5FD] bg-[#F8FBFF] px-2 text-center text-xs font-medium text-[#1E40AF]"
          data-testid="product-gallery-add-image-tile"
          aria-label="Add image to product gallery"
        >
          Add image
        </button>
      </div>

      {showAddPanel ? (
        <div className="mt-3 rounded-xl border border-[#D5E2F0] bg-[#F8FBFF] p-3 text-sm" data-testid="product-gallery-add-image-panel">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-[#334155]">
              Upload from computer
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadChange}
                className="rounded-lg border border-[#C7D5E8] bg-white px-2 py-1.5 text-xs"
                data-testid="product-gallery-upload-input"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#334155] md:col-span-2">
              Add from URL
              <div className="flex gap-2">
                <input
                  type="url"
                  value={pendingUrl}
                  onChange={(event) => setPendingUrl(event.target.value)}
                  placeholder="https://cdn.example.com/product-front.jpg"
                  className="w-full rounded-lg border border-[#C7D5E8] bg-white px-2 py-1.5 text-xs"
                  data-testid="product-gallery-url-input"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-1.5 text-xs font-medium text-white"
                  data-testid="product-gallery-add-url-button"
                >
                  Add URL
                </button>
              </div>
            </label>
          </div>
          <button
            type="button"
            disabled
            className="mt-3 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B]"
            data-testid="product-gallery-image-studio-hook"
          >
            Add from Image Studio (Coming soon)
          </button>
          {addMessage ? <p className="mt-2 text-xs text-[#334155]">{addMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
