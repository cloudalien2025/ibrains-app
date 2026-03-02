export interface MatchableNode {
  handle?: string | null;
  title: string;
  tags?: string[];
  bodyText?: string | null;
}

export interface MatchResult {
  score: number;
  reason: string;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function unique(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

export function scoreProductToArticle(product: MatchableNode, article: MatchableNode): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  const articleCombined = `${article.title} ${article.bodyText ?? ""}`.toLowerCase();

  if (product.handle && articleCombined.includes(product.handle.toLowerCase())) {
    score += 3.5;
    reasons.push(`handle_match:${product.handle.toLowerCase()}`);
  }

  const productTags = (product.tags ?? []).map((tag) => tag.toLowerCase());
  const articleTags = (article.tags ?? []).map((tag) => tag.toLowerCase());
  const tagOverlap = productTags.filter((tag) => articleTags.includes(tag));
  if (tagOverlap.length > 0) {
    const tagScore = Math.min(4, tagOverlap.length * 1.5);
    score += tagScore;
    reasons.push(`tag_overlap:${tagOverlap.slice(0, 4).join("|")}`);
  }

  const productTokens = unique(tokenize(`${product.title} ${(product.tags ?? []).join(" ")}`));
  const articleTokens = new Set(unique(tokenize(articleCombined)));
  const keywordOverlap = productTokens.filter((token) => articleTokens.has(token));

  if (keywordOverlap.length > 0) {
    const overlapRatio = keywordOverlap.length / Math.max(productTokens.length, 1);
    const keywordScore = Math.min(4, overlapRatio * 8);
    score += keywordScore;
    reasons.push(`keyword_overlap:${keywordOverlap.slice(0, 6).join("|")}`);
  }

  return {
    score: Number(score.toFixed(3)),
    reason: reasons.join("|"),
  };
}
