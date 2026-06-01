export interface ProductImageSelectionCandidate {
  id?: string | null;
  url: string | null | undefined;
  altText?: string | null;
  title?: string | null;
  role?: string | null;
  type?: string | null;
  source?: string | null;
  position?: number | null;
  originalIndex?: number | null;
}

export interface ProductImageSelectionInput {
  images: readonly ProductImageSelectionCandidate[];
  featuredImageId?: string | null;
  featuredImageUrl?: string | null;
}

interface RankedCandidate {
  index: number;
  position: number;
  isExplicitRole: boolean;
  isFeaturedMatch: boolean;
  hasFrontCue: boolean;
  hasBackCue: boolean;
}

const EXPLICIT_ROLE_PATTERN = /\b(front|primary|featured|hero|main)\b/i;
const FRONT_CUE_PATTERN = /\b(front|primary|main|hero|bottle[-_\s]?front|label[-_\s]?front)\b/i;
const BACK_CUE_PATTERN =
  /\b(supplement[\s-_]?facts|nutrition[\s-_]?facts|facts|back|back[\s-_]?label|side|suggested[\s-_]?use|directions|3[\s-_]?pack|three[\s-_]?pack|lifestyle)\b/i;

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrlForMatch(value: string | null | undefined): string {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase().split("?")[0]?.split("#")[0] || "";
  }
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  if (left.hasBackCue !== right.hasBackCue) return left.hasBackCue ? 1 : -1;
  if (left.hasFrontCue !== right.hasFrontCue) return left.hasFrontCue ? -1 : 1;
  if (left.position !== right.position) return left.position - right.position;
  return left.index - right.index;
}

export function getDefaultProductImageIndex(input: ProductImageSelectionInput): number {
  const featuredImageId = clean(input.featuredImageId);
  const featuredImageUrl = normalizeUrlForMatch(input.featuredImageUrl);
  const ranked: RankedCandidate[] = [];

  for (let index = 0; index < input.images.length; index += 1) {
    const image = input.images[index];
    const url = clean(image?.url);
    if (!url) continue;

    const textSignature = [
      clean(image?.role),
      clean(image?.type),
      clean(image?.title),
      clean(image?.altText),
      clean(image?.source),
      url,
    ]
      .join(" ")
      .toLowerCase();

    const explicitRole = EXPLICIT_ROLE_PATTERN.test(`${clean(image?.role)} ${clean(image?.type)}`);
    const featuredMatch =
      (featuredImageId.length > 0 && clean(image?.id) === featuredImageId) ||
      (featuredImageUrl.length > 0 && normalizeUrlForMatch(url) === featuredImageUrl);
    const positionFromInput = typeof image?.position === "number" && Number.isFinite(image.position) ? image.position : null;
    const originalIndex = typeof image?.originalIndex === "number" && Number.isFinite(image.originalIndex) ? image.originalIndex : null;

    ranked.push({
      index,
      position: positionFromInput ?? originalIndex ?? index,
      isExplicitRole: explicitRole,
      isFeaturedMatch: featuredMatch,
      hasFrontCue: FRONT_CUE_PATTERN.test(textSignature),
      hasBackCue: BACK_CUE_PATTERN.test(textSignature),
    });
  }

  if (ranked.length === 0) return -1;

  const explicit = ranked.filter((candidate) => candidate.isExplicitRole).sort(compareCandidates);
  if (explicit.length > 0) return explicit[0]!.index;

  const featured = ranked.filter((candidate) => candidate.isFeaturedMatch).sort(compareCandidates);
  if (featured.length > 0) return featured[0]!.index;

  const heuristicFront = ranked
    .filter((candidate) => candidate.hasFrontCue && !candidate.hasBackCue)
    .sort(compareCandidates);
  if (heuristicFront.length > 0) return heuristicFront[0]!.index;

  const neutral = ranked.filter((candidate) => !candidate.hasBackCue).sort(compareCandidates);
  if (neutral.length > 0) return neutral[0]!.index;

  ranked.sort(compareCandidates);
  return ranked[0]!.index;
}
