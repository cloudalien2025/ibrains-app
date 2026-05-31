export type ProductImagePriority =
  | "front"
  | "facts"
  | "side"
  | "pack3"
  | "pack6"
  | "lifestyle"
  | "other";

export interface ProductImageCandidate {
  url: string | null | undefined;
  altText?: string | null;
  type?: string | null;
  source?: string | null;
}

export interface OrderedProductImage {
  id: string;
  url: string;
  altText: string;
  type: ProductImagePriority;
  source: string;
  originalIndex: number;
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferPriority(candidate: ProductImageCandidate): ProductImagePriority {
  const type = clean(candidate.type).toLowerCase();
  const alt = clean(candidate.altText).toLowerCase();
  const url = clean(candidate.url).toLowerCase();
  const signature = `${type} ${alt} ${url}`;

  if (/(front|primary|hero|main)/.test(signature)) return "front";
  if (/(supplement[\s-_]?facts|nutrition[\s-_]?facts|facts|back[\s-_]?label|back)/.test(signature)) return "facts";
  if (/(suggested[\s-_]?use|directions|warning|side)/.test(signature)) return "side";
  if (/(3[\s-_]?pack|three[\s-_]?pack|3pk|threepk)/.test(signature)) return "pack3";
  if (/(6[\s-_]?pack|six[\s-_]?pack|6pk|sixpk)/.test(signature)) return "pack6";
  if (/(lifestyle|in[\s-_]?use|ugc|scene)/.test(signature)) return "lifestyle";

  return "other";
}

function rank(priority: ProductImagePriority): number {
  if (priority === "front") return 0;
  if (priority === "facts") return 1;
  if (priority === "side") return 2;
  if (priority === "pack3") return 3;
  if (priority === "pack6") return 4;
  if (priority === "lifestyle") return 5;
  return 6;
}

export function orderProductImages(candidates: ProductImageCandidate[]): OrderedProductImage[] {
  const seen = new Set<string>();

  return candidates
    .map((candidate, index) => {
      const url = clean(candidate.url);
      if (!url) return null;
      if (seen.has(url)) return null;
      seen.add(url);

      const priority = inferPriority(candidate);
      return {
        id: `image-${index}-${url}`,
        url,
        altText: clean(candidate.altText),
        type: priority,
        source: clean(candidate.source) || "unknown",
        originalIndex: index,
      } satisfies OrderedProductImage;
    })
    .filter((image): image is OrderedProductImage => Boolean(image))
    .sort((left, right) => {
      const rankDiff = rank(left.type) - rank(right.type);
      if (rankDiff !== 0) return rankDiff;
      return left.originalIndex - right.originalIndex;
    });
}
