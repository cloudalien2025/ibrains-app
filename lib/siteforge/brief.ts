import { BrandTone, brandToneOptions, WebsiteBrief, WebsiteGoal, websiteGoalOptions } from "@/lib/siteforge/contracts";

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseWebsiteBrief(value: unknown): WebsiteBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;

  const businessName = stringField(record.businessName);
  const businessType = stringField(record.businessType);
  const businessDescription = stringField(record.businessDescription);
  const targetAudience = stringField(record.targetAudience);
  const websiteGoalRaw = stringField(record.websiteGoal);
  const mainOffer = stringField(record.mainOffer);
  const brandToneRaw = stringField(record.brandTone);

  if (!businessName || !businessType || !businessDescription || !targetAudience || !mainOffer) {
    return null;
  }

  if (!(websiteGoalOptions as readonly string[]).includes(websiteGoalRaw)) {
    return null;
  }

  if (!(brandToneOptions as readonly string[]).includes(brandToneRaw)) {
    return null;
  }

  const marketLocation = stringField(record.marketLocation);
  const competitors = stringField(record.competitors);
  const differentiators = stringField(record.differentiators);

  return {
    businessName,
    businessType,
    businessDescription,
    targetAudience,
    websiteGoal: websiteGoalRaw as WebsiteGoal,
    mainOffer,
    brandTone: brandToneRaw as BrandTone,
    marketLocation: marketLocation || null,
    competitors: competitors || null,
    differentiators: differentiators || null,
  };
}

export function synthesizePromptFromBrief(brief: WebsiteBrief): string {
  const optional = [
    brief.marketLocation ? `Location/market: ${brief.marketLocation}` : null,
    brief.competitors ? `Competitors/inspiration: ${brief.competitors}` : null,
    brief.differentiators ? `Differentiators/notes: ${brief.differentiators}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const goalLabel = websiteGoalLabel(brief.websiteGoal);
  const toneLabel = brandToneLabel(brief.brandTone);

  return [
    `Business name: ${brief.businessName}`,
    `Business type: ${brief.businessType}`,
    `What the business does: ${brief.businessDescription}`,
    `Target audience: ${brief.targetAudience}`,
    `Website goal: ${goalLabel}`,
    `Main offer: ${brief.mainOffer}`,
    `Brand tone: ${toneLabel}`,
    optional,
  ]
    .filter((line) => Boolean(line))
    .join("\n");
}

export function websiteGoalLabel(goal: WebsiteGoal): string {
  switch (goal) {
    case "book_calls":
      return "Book calls";
    case "capture_leads":
      return "Capture leads";
    case "sell_products":
      return "Sell products";
    case "drive_demos_trials":
      return "Drive demos/trials";
    case "build_authority":
      return "Build authority";
    default:
      return goal;
  }
}

export function brandToneLabel(tone: BrandTone): string {
  switch (tone) {
    case "premium":
      return "Premium";
    case "friendly":
      return "Friendly";
    case "expert":
      return "Expert";
    case "bold":
      return "Bold";
    case "modern":
      return "Modern";
    default:
      return tone;
  }
}
