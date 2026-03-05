import crypto from "crypto";
import { queryDb } from "@/src/directoryiq/repositories/db";

export type AnchorType = "brand" | "exact" | "partial" | "generic" | "geo" | "service";

export type ListingAnchorInput = {
  listingId: string;
  title: string;
  category?: string | null;
  city?: string | null;
  region?: string | null;
  services?: string[] | null;
};

export function normalizeAnchorText(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSlug(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeAnchorText(value).replace(/\s+/g, "-");
}

function buildAnchorHash(text: string): string {
  return crypto.createHash("sha256").update(normalizeAnchorText(text)).digest("hex");
}

export function classifyAnchorType(anchor: string, listing: ListingAnchorInput): AnchorType {
  const normalized = normalizeAnchorText(anchor);
  const name = normalizeAnchorText(listing.title);
  const category = normalizeAnchorText(listing.category ?? "");
  const geo = normalizeAnchorText([listing.city, listing.region].filter(Boolean).join(" "));
  const services = (listing.services ?? []).map(normalizeAnchorText).filter(Boolean);

  if (normalized === name) return "brand";
  if (name && normalized.includes(name)) return "brand";
  if (services.some((service) => service && normalized.includes(service))) return "service";
  if (category && normalized.includes(category)) return "exact";
  if (geo && normalized.includes(geo)) return "geo";
  if (normalized.length <= 4) return "generic";
  return "partial";
}

export function getCandidateAnchors(listing: ListingAnchorInput): string[] {
  const candidates: string[] = [];
  const name = listing.title.trim();
  const category = (listing.category ?? "").trim();
  const geo = [listing.city, listing.region].filter(Boolean).join(" ").trim();
  const services = (listing.services ?? []).map((service) => service.trim()).filter(Boolean).slice(0, 2);

  if (name) candidates.push(name);
  if (name && geo) candidates.push(`${name} ${geo}`);
  if (category && geo) candidates.push(`${category} ${geo}`);
  services.forEach((service) => {
    if (service && geo) candidates.push(`${service} ${geo}`);
  });

  candidates.push("DirectoryIQ listing");

  const seen = new Set<string>();
  return candidates.filter((anchor) => {
    const normalized = normalizeAnchorText(anchor);
    if (!normalized) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function chooseAnchorFor(params: {
  listing: ListingAnchorInput;
  blogUrl: string;
  usedAnchorsLedger: Set<string>;
}): { anchor: string; anchorHash: string; anchorType: AnchorType } {
  const candidates = getCandidateAnchors(params.listing);
  const fallback = candidates[0] ?? params.listing.title;

  for (const candidate of candidates) {
    const hash = buildAnchorHash(candidate);
    if (!params.usedAnchorsLedger.has(hash)) {
      return {
        anchor: candidate,
        anchorHash: hash,
        anchorType: classifyAnchorType(candidate, params.listing),
      };
    }
  }

  const fallbackHash = buildAnchorHash(fallback);
  return {
    anchor: fallback,
    anchorHash: fallbackHash,
    anchorType: classifyAnchorType(fallback, params.listing),
  };
}

export async function recordAnchorUsage(params: {
  tenantId: string;
  listingId: string;
  blogUrl: string;
  anchorText: string;
  anchorType: AnchorType;
  anchorHash?: string;
}): Promise<void> {
  const hash = params.anchorHash ?? buildAnchorHash(params.anchorText);
  await queryDb(
    `
    INSERT INTO directoryiq_anchor_ledger
      (tenant_id, listing_id, blog_url, anchor_text, anchor_hash, anchor_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (tenant_id, listing_id, blog_url, anchor_hash)
    DO NOTHING
    `,
    [params.tenantId, params.listingId, params.blogUrl, params.anchorText, hash, params.anchorType]
  );
}

export async function loadUsedAnchorHashes(params: {
  tenantId: string;
  listingId: string;
}): Promise<Set<string>> {
  const rows = await queryDb<{ anchor_hash: string }>(
    `
    SELECT anchor_hash
    FROM directoryiq_anchor_ledger
    WHERE tenant_id = $1 AND listing_id = $2
    `,
    [params.tenantId, params.listingId]
  );
  return new Set(rows.map((row) => row.anchor_hash));
}

export function slugifyAnchor(value: string): string {
  return toSlug(value);
}
