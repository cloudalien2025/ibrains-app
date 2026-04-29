import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudPoi } from "@/lib/studio/domara/campaign-location-intelligence";
import {
  createEmptyCasaHudMediaPlanData,
  type CasaHudListingImageCoverage,
  type CasaHudMapLocationVisualPlanItem,
  type CasaHudMediaPlanData,
  type CasaHudMediaProviderStatus,
  type CasaHudSceneAssetMapping,
  type CasaHudShotListItem,
  type CasaHudThumbnailCandidateInput,
  type CasaHudVisualAsset,
  type CasaHudVisualAssetType,
} from "@/lib/studio/domara/campaign-media-planning";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function orderedApprovedListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const rankMap = new Map(campaign.listingRankOrder.map((id, index) => [id, index]));
  return [...campaign.approvedListings].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.overallScore - left.overallScore;
  });
}

function photoCoverageState(imageCount: number): "strong" | "partial" | "missing" {
  if (imageCount >= 2) return "strong";
  if (imageCount === 1) return "partial";
  return "missing";
}

function assetConfidence(photoAvailability: CasaHudValidatedListing["photoAvailability"], fallback = false) {
  if (fallback) return 0.34;
  if (photoAvailability === "available") return 0.9;
  if (photoAvailability === "limited") return 0.68;
  return 0.42;
}

function takeNarrationExcerpt(input: string, maxLength = 160) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildListingAssets(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): CasaHudVisualAsset[] {
  return listings.flatMap<CasaHudVisualAsset>((listing) => {
    const urls = uniqueStrings([
      listing.featuredImageUrl,
      listing.metadataImageUrl,
      ...listing.imageUrls,
      listing.thumbnailUrl,
      listing.sourceThumbnailUrl,
    ]);
    if (urls.length === 0) {
      return [
        {
          id: stableCasaHudId("casahud-visual-asset", `${campaign.id}:${listing.id}:placeholder`),
          type: "fallback_placeholder",
          title: `${listing.title} placeholder`,
          sourceProvider: "casahud_visual_placeholders",
          listingId: listing.id,
          description: `Using CasaHUD visual placeholders until listing media is connected for ${listing.title}.`,
          usageRightsStatus: "planning_only",
          confidence: assetConfidence(listing.photoAvailability, true),
          availabilityStatus: "placeholder",
          warning: "Listing photo coverage is missing, so this remains a planning placeholder rather than a real source image.",
        },
      ];
    }

    return urls.slice(0, 3).map((sourceUrl, index) => ({
      id: stableCasaHudId("casahud-visual-asset", `${campaign.id}:${listing.id}:listing-image:${index}`),
      type: "listing_image" as const,
      title: `${listing.title} image ${index + 1}`,
      sourceProvider: listing.provider,
      sourceUrl,
      listingId: listing.id,
      description:
        listing.sourceType === "imported_url"
          ? `Source preview image ${index + 1} imported from ${listing.sourceLabel || listing.sourceHost || "the listing URL"} for ${listing.title}.`
          : `Listing photo ${index + 1} for ${listing.title} in ${listing.locationText}.`,
      usageRightsStatus: "unknown" as const,
      confidence: assetConfidence(listing.photoAvailability),
      availabilityStatus: "available" as const,
      warning:
        listing.sourceType === "imported_url"
          ? "This preview image comes from page metadata, so confirm the property details before relying on it across multiple scenes."
          : listing.photoAvailability === "limited"
            ? "Listing media is thinner than ideal, so scene reuse should stay selective."
            : undefined,
    }));
  });
}

function buildMapLocationAssets(campaign: CasaHudCampaign): CasaHudVisualAsset[] {
  const mapAssets = campaign.mapSceneIdeas.map((scene) => ({
    id: stableCasaHudId("casahud-visual-asset", `${campaign.id}:${scene.id}:map`),
    type: "map_visual" as const,
    title: scene.title,
    sourceProvider: scene.provider,
    listingId: scene.associatedListingId,
    mapSceneId: scene.id,
    description: scene.suggestedVisual,
    usageRightsStatus: "planning_only" as const,
    confidence: scene.confidence === "high" ? 0.88 : scene.confidence === "medium" ? 0.74 : 0.56,
    availabilityStatus: "planned" as const,
    warning:
      scene.confidence === "fallback"
        ? "Map scene uses fallback location coverage, so this stays a planning reference until stronger map visuals are connected."
        : undefined,
  }));

  const poiAssets = (campaign.poiBundle?.cards || []).slice(0, 6).map((poi) => ({
    id: stableCasaHudId("casahud-visual-asset", `${campaign.id}:${poi.id}:poi`),
    type: "poi_visual" as const,
    title: poi.name,
    sourceProvider: poi.provider,
    listingId: poi.associatedListingId,
    poiId: poi.id,
    description: poi.relevanceReason,
    usageRightsStatus: "planning_only" as const,
    confidence: poi.sourceConfidence === "high" ? 0.86 : poi.sourceConfidence === "medium" ? 0.7 : 0.52,
    availabilityStatus: "planned" as const,
    warning:
      poi.sourceConfidence === "fallback"
        ? "POI context is using fallback location intelligence, so this remains a planning asset until live place visuals are connected."
        : undefined,
  }));

  const localHighlightAssets = campaign.localHighlights.slice(0, 4).map((highlight) => ({
    id: stableCasaHudId("casahud-visual-asset", `${campaign.id}:${highlight.id}:location`),
    type: "location_context" as const,
    title: highlight.title,
    sourceProvider: highlight.provider,
    listingId: highlight.associatedListingId,
    description: highlight.description,
    usageRightsStatus: "planning_only" as const,
    confidence: highlight.sourceConfidence === "high" ? 0.84 : highlight.sourceConfidence === "medium" ? 0.68 : 0.5,
    availabilityStatus: "planned" as const,
    warning:
      highlight.sourceConfidence === "fallback"
        ? "Location context is using fallback planning inputs until richer provider coverage is connected."
        : undefined,
  }));

  return [...mapAssets, ...poiAssets, ...localHighlightAssets];
}

function assetIdsForListing(assets: CasaHudVisualAsset[], listingId?: string, preferredTypes?: CasaHudVisualAssetType[]) {
  const matches = assets.filter((asset) => {
    if (listingId && asset.listingId !== listingId) return false;
    if (preferredTypes && preferredTypes.length > 0 && !preferredTypes.includes(asset.type)) return false;
    return true;
  });
  return matches.map((asset) => asset.id);
}

function firstMatchingAssets(assets: CasaHudVisualAsset[], count: number, predicate: (asset: CasaHudVisualAsset) => boolean) {
  return assets.filter(predicate).slice(0, count).map((asset) => asset.id);
}

function relatedPoiIdsForListing(pois: CasaHudPoi[], listingId?: string) {
  if (!listingId) return [];
  return pois.filter((poi) => poi.associatedListingId === listingId).map((poi) => poi.id);
}

function buildSceneAssetMappings(campaign: CasaHudCampaign, assets: CasaHudVisualAsset[]): CasaHudSceneAssetMapping[] {
  const poiCards = campaign.poiBundle?.cards || [];
  const leadListing = orderedApprovedListings(campaign)[0];

  return campaign.scriptSegments.map((segment, index) => {
    const listingId = segment.associatedListingId || campaign.propertySegments[index - 2]?.listingId || leadListing?.id;
    const listingAssetIds = assetIdsForListing(assets, listingId, ["listing_image", "fallback_placeholder"]).slice(0, 2);
    const relatedMapAssetIds = assetIdsForListing(assets, listingId, ["map_visual", "location_context"]).slice(0, 1);
    const relatedPoiAssetIds = firstMatchingAssets(
      assets,
      1,
      (asset) => asset.type === "poi_visual" && relatedPoiIdsForListing(poiCards, listingId).includes(asset.poiId || ""),
    );
    const globalMapAssetIds = firstMatchingAssets(assets, 1, (asset) => asset.type === "map_visual");
    const globalLocationIds = firstMatchingAssets(assets, 1, (asset) => asset.type === "location_context");

    let assignedAssetIds: string[] = [];
    let recommendedAssetType: CasaHudVisualAssetType = "location_context";
    let visualPurpose = "Support the narration with place-first coverage before final asset selection.";

    switch (segment.segmentType) {
      case "hook":
      case "premise":
        assignedAssetIds = uniqueStrings([...globalMapAssetIds, ...listingAssetIds.slice(0, 1), ...globalLocationIds]).slice(0, 2);
        recommendedAssetType = globalMapAssetIds.length > 0 ? "map_visual" : listingAssetIds.length > 0 ? "listing_image" : "fallback_placeholder";
        visualPurpose = "Open with the strongest location or lead-property anchor that makes the hook feel immediate.";
        break;
      case "location_context":
        assignedAssetIds = uniqueStrings([...relatedMapAssetIds, ...relatedPoiAssetIds, ...globalLocationIds]).slice(0, 3);
        recommendedAssetType = relatedMapAssetIds.length > 0 ? "map_visual" : relatedPoiAssetIds.length > 0 ? "poi_visual" : "location_context";
        visualPurpose = "Translate the place story into a clean regional or neighborhood visual beat.";
        break;
      case "property_focus":
        assignedAssetIds = uniqueStrings([...listingAssetIds, ...relatedMapAssetIds, ...relatedPoiAssetIds]).slice(0, 3);
        recommendedAssetType = listingAssetIds.length > 0 ? assets.find((asset) => asset.id === listingAssetIds[0])?.type || "listing_image" : "fallback_placeholder";
        visualPurpose = "Use listing imagery first, then back it up with place context that explains why the home made the shortlist.";
        break;
      case "comparison":
        assignedAssetIds = uniqueStrings([
          ...firstMatchingAssets(assets, 2, (asset) => asset.type === "listing_image"),
          ...globalMapAssetIds,
        ]).slice(0, 3);
        recommendedAssetType = "listing_image";
        visualPurpose = "Cut between multiple approved listings so the viewer can feel the differences without a ranking monologue.";
        break;
      case "transition":
        assignedAssetIds = uniqueStrings([...relatedMapAssetIds, ...globalLocationIds, ...listingAssetIds.slice(0, 1)]).slice(0, 2);
        recommendedAssetType = relatedMapAssetIds.length > 0 ? "map_visual" : "location_context";
        visualPurpose = "Bridge scenes with a map, neighborhood, or regional cue instead of stalling on repeated property footage.";
        break;
      case "closing_cta":
        assignedAssetIds = uniqueStrings([...listingAssetIds.slice(0, 1), ...globalMapAssetIds, ...globalLocationIds]).slice(0, 2);
        recommendedAssetType = listingAssetIds.length > 0 ? "listing_image" : "location_context";
        visualPurpose = "Return to the strongest hero visual while reminding the viewer what the broader place story means.";
        break;
    }

    const assignedAssets = assignedAssetIds
      .map((assetId) => assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is CasaHudVisualAsset => Boolean(asset));
    const availableCount = assignedAssets.filter((asset) => asset.availabilityStatus === "available").length;
    const placeholderCount = assignedAssets.filter((asset) => asset.availabilityStatus === "placeholder").length;
    const warnings = uniqueStrings([
      ...assignedAssets.flatMap((asset) => (asset.warning ? [asset.warning] : [])),
      placeholderCount > 0 ? "One or more assigned assets are CasaHUD placeholders, so this scene still needs stronger media coverage before render." : null,
      assignedAssets.length === 0 ? "No assets have been matched to this scene yet." : null,
    ]);

    const coverageStatus =
      availableCount >= 1 && assignedAssets.length >= 2 ? "strong" : assignedAssets.length > 0 ? "partial" : "missing";

    return {
      sceneId: stableCasaHudId("casahud-scene-mapping", `${campaign.id}:${segment.id}:scene`),
      segmentId: segment.id,
      sceneTitle: segment.title,
      narrationExcerpt: takeNarrationExcerpt(segment.narration),
      assignedAssetIds,
      recommendedAssetType,
      visualPurpose,
      coverageStatus,
      warnings,
    };
  });
}

function buildShotList(campaign: CasaHudCampaign, sceneMappings: CasaHudSceneAssetMapping[]): CasaHudShotListItem[] {
  return sceneMappings.map((mapping, index) => ({
    id: stableCasaHudId("casahud-shot-list-item", `${campaign.id}:${mapping.segmentId}:shot`),
    order: index + 1,
    title: mapping.sceneTitle,
    description: mapping.visualPurpose,
    associatedListingId:
      campaign.scriptSegments.find((segment) => segment.id === mapping.segmentId)?.associatedListingId ||
      campaign.propertySegments[index]?.listingId,
    associatedSceneId: mapping.sceneId,
    recommendedVisualType: mapping.recommendedAssetType,
    assetIds: mapping.assignedAssetIds,
    notes: uniqueStrings([
      mapping.coverageStatus === "strong"
        ? "Coverage is strong enough to edit this scene without placeholder-heavy repetition."
        : mapping.coverageStatus === "partial"
          ? "Coverage is usable but should stay economical until stronger media is connected."
          : "This scene still needs stronger media support before render planning.",
      ...mapping.warnings,
    ]),
  }));
}

function buildListingCoverage(campaign: CasaHudCampaign, assets: CasaHudVisualAsset[], listings: CasaHudValidatedListing[]): CasaHudListingImageCoverage[] {
  return listings.map((listing) => {
    const relatedAssets = assets.filter((asset) => asset.listingId === listing.id && (asset.type === "listing_image" || asset.type === "fallback_placeholder"));
    const availableImageCount = relatedAssets.filter((asset) => asset.type === "listing_image").length;
    const coverageStatus = photoCoverageState(availableImageCount);
    return {
      listingId: listing.id,
      listingTitle: listing.title,
      availableImageCount,
      assetIds: relatedAssets.map((asset) => asset.id),
      coverageStatus,
      coverageSummary:
        coverageStatus === "strong"
          ? `${listing.title} has enough listing imagery to support multiple scenes without leaning on placeholders.`
          : coverageStatus === "partial"
            ? `${listing.title} has limited image coverage, so CasaHUD should reuse the strongest frame selectively.`
            : `Using CasaHUD visual placeholders until listing media is connected for ${listing.title}.`,
      warning:
        coverageStatus === "missing"
          ? "No listing images were available, so this property currently relies on CasaHUD planning placeholders."
          : coverageStatus === "partial"
            ? "Photo coverage is usable but thin, so avoid stretching this listing across too many scenes."
            : undefined,
    };
  });
}

function buildMapLocationVisualPlan(campaign: CasaHudCampaign, assets: CasaHudVisualAsset[]): CasaHudMapLocationVisualPlanItem[] {
  const mapItems = campaign.mapSceneIdeas.map((scene) => ({
    id: stableCasaHudId("casahud-map-plan", `${campaign.id}:${scene.id}:map-plan`),
    title: scene.title,
    visualType: "map_scene" as const,
    description: scene.description,
    associatedListingId: scene.associatedListingId,
    associatedMapSceneId: scene.id,
    suggestedUse: scene.suggestedVisual,
    provider: scene.provider,
    confidence: scene.confidence,
    assetId: assets.find((asset) => asset.mapSceneId === scene.id)?.id,
  }));

  const poiItems = (campaign.poiBundle?.cards || []).slice(0, 6).map((poi) => ({
    id: stableCasaHudId("casahud-map-plan", `${campaign.id}:${poi.id}:poi-plan`),
    title: poi.name,
    visualType: "poi_context" as const,
    description: poi.relevanceReason,
    associatedListingId: poi.associatedListingId,
    associatedPoiId: poi.id,
    suggestedUse: `Use ${poi.name} as contextual proof for ${poi.locationText}.`,
    provider: poi.provider,
    confidence: poi.sourceConfidence,
    assetId: assets.find((asset) => asset.poiId === poi.id)?.id,
  }));

  const locationItems = campaign.localHighlights.slice(0, 4).map((highlight) => ({
    id: stableCasaHudId("casahud-map-plan", `${campaign.id}:${highlight.id}:location-plan`),
    title: highlight.title,
    visualType: "location_anchor" as const,
    description: highlight.description,
    associatedListingId: highlight.associatedListingId,
    suggestedUse: `Use ${highlight.locationText} as a location anchor that supports the surrounding narration.`,
    provider: highlight.provider,
    confidence: highlight.sourceConfidence,
    assetId: assets.find((asset) => asset.title === highlight.title && asset.listingId === highlight.associatedListingId)?.id,
  }));

  return [...mapItems, ...poiItems, ...locationItems];
}

function buildThumbnailCandidates(campaign: CasaHudCampaign, assets: CasaHudVisualAsset[], listings: CasaHudValidatedListing[]): CasaHudThumbnailCandidateInput[] {
  const leadListing = listings[0];
  const leadAssets = leadListing ? assetIdsForListing(assets, leadListing.id, ["listing_image", "fallback_placeholder"]).slice(0, 1) : [];
  const mapAsset = firstMatchingAssets(assets, 1, (asset) => asset.type === "map_visual");
  const secondListing = listings[1];
  const comparisonAssets = uniqueStrings([
    ...leadAssets,
    ...(secondListing ? assetIdsForListing(assets, secondListing.id, ["listing_image", "fallback_placeholder"]).slice(0, 1) : []),
  ]);

  const candidates: CasaHudThumbnailCandidateInput[] = [];

  if (leadListing) {
    candidates.push({
      id: stableCasaHudId("casahud-thumbnail-input", `${campaign.id}:${leadListing.id}:hero`),
      title: "Lead property hero frame",
      rationale: `${leadListing.title} is the strongest approved property, so it should anchor the first thumbnail direction.`,
      associatedAssetIds: uniqueStrings([...leadAssets, ...mapAsset]).slice(0, 2),
      listingId: leadListing.id,
      textOverlayIdea: campaign.selectedViralTitle,
      compositionNotes: "Use the strongest listing image as the hero frame, then add a restrained regional cue if the title needs location context.",
      warnings: leadAssets.length === 0 ? ["Lead listing is still relying on a placeholder asset."] : [],
    });
  }

  if (campaign.mapSceneIdeas.length > 0 || campaign.locationStory) {
    candidates.push({
      id: stableCasaHudId("casahud-thumbnail-input", `${campaign.id}:location-angle`),
      title: "Location-first angle",
      rationale: "The hook is partly carried by place context, so a map or regional anchor can support the click without overloading the frame.",
      associatedAssetIds: uniqueStrings([...mapAsset, ...leadAssets]).slice(0, 2),
      textOverlayIdea: campaign.marketRegionHint || campaign.selectedViralTitle,
      compositionNotes: "Pair the lead property with a location anchor so the frame feels editorial instead of like a raw listing export.",
      warnings: mapAsset.length === 0 ? ["No dedicated map visual is planned yet, so this angle may need a placeholder location frame."] : [],
    });
  }

  if (comparisonAssets.length >= 2) {
    candidates.push({
      id: stableCasaHudId("casahud-thumbnail-input", `${campaign.id}:comparison-angle`),
      title: "Two-property comparison",
      rationale: "A side-by-side frame works when the shortlist is part of the click promise and two approved properties have usable imagery.",
      associatedAssetIds: comparisonAssets.slice(0, 2),
      listingId: leadListing?.id,
      textOverlayIdea: `Real ${campaign.marketRegionHint || "shortlist"} options`,
      compositionNotes: "Use two approved properties with clear hierarchy so the frame reads like a curated shortlist rather than a collage.",
      warnings: comparisonAssets.some((assetId) => assets.find((asset) => asset.id === assetId)?.type === "fallback_placeholder")
        ? ["At least one comparison asset is still a CasaHUD placeholder."]
        : [],
    });
  }

  return candidates;
}

function buildWarnings(
  campaign: CasaHudCampaign,
  listingCoverage: CasaHudListingImageCoverage[],
  sceneMappings: CasaHudSceneAssetMapping[],
  mapPlan: CasaHudMapLocationVisualPlanItem[],
): string[] {
  const warnings = uniqueStrings([
    ...listingCoverage.flatMap((item) => (item.warning ? [item.warning] : [])),
    ...sceneMappings.flatMap((item) => item.warnings),
    mapPlan.length === 0 ? "Map and location visual planning is still thin, so the package may need stronger place coverage before render planning." : null,
    sceneMappings.filter((item) => item.coverageStatus === "missing").length > 0
      ? "One or more script scenes still have missing visual coverage."
      : null,
    campaign.scriptWarnings.length > 0 ? "Script warnings remain visible, so visual planning should stay conservative about unsupported claims." : null,
  ]);

  return warnings;
}

function buildProviderStatuses(
  listingCoverage: CasaHudListingImageCoverage[],
  mapPlan: CasaHudMapLocationVisualPlanItem[],
  assets: CasaHudVisualAsset[],
): CasaHudMediaProviderStatus[] {
  const availableListingImages = listingCoverage.reduce((sum, item) => sum + item.availableImageCount, 0);
  const placeholderCount = assets.filter((asset) => asset.type === "fallback_placeholder").length;

  return [
    {
      provider: "listing_source_media",
      label: "Listing source media",
      state: availableListingImages > 0 ? "connected" : "fallback",
      configured: true,
      used: availableListingImages > 0,
      detail:
        availableListingImages > 0
          ? `${availableListingImages} listing image${availableListingImages === 1 ? "" : "s"} were normalized into the media plan.`
          : "No approved listing images were available, so CasaHUD is relying on placeholders until listing media is connected.",
      warning: availableListingImages > 0 ? undefined : "Connect stronger listing media coverage to reduce placeholder use.",
    },
    {
      provider: "location_visual_plan",
      label: "Map and location planning",
      state: mapPlan.length > 0 ? "connected" : "fallback",
      configured: true,
      used: mapPlan.length > 0,
      detail:
        mapPlan.length > 0
          ? `${mapPlan.length} map or location planning asset${mapPlan.length === 1 ? "" : "s"} are ready for scene assignment.`
          : "Location intelligence did not yield enough map or place visuals, so the plan remains property-heavy.",
      warning: mapPlan.length > 0 ? undefined : "Add stronger map or POI coverage to improve scene transitions and thumbnail options.",
    },
    {
      provider: "casahud_visual_placeholders",
      label: "CasaHUD visual placeholders",
      state: placeholderCount > 0 ? "fallback" : "connected",
      configured: true,
      used: placeholderCount > 0,
      detail:
        placeholderCount > 0
          ? `${placeholderCount} placeholder asset${placeholderCount === 1 ? "" : "s"} are covering thin media areas until real visuals are connected.`
          : "No placeholders were needed in the current media plan.",
    },
  ];
}

function buildSummary(
  campaign: CasaHudCampaign,
  sceneMappings: CasaHudSceneAssetMapping[],
  listingCoverage: CasaHudListingImageCoverage[],
  mapPlan: CasaHudMapLocationVisualPlanItem[],
): string {
  const strongScenes = sceneMappings.filter((scene) => scene.coverageStatus === "strong").length;
  const listingsWithImages = listingCoverage.filter((item) => item.availableImageCount > 0).length;
  return `A production-ready media plan built from ${sceneMappings.length} scripted scenes, ${listingsWithImages} listing${listingsWithImages === 1 ? "" : "s"} with source imagery, and ${mapPlan.length} map or location planning cue${mapPlan.length === 1 ? "" : "s"}. ${strongScenes} scene${strongScenes === 1 ? "" : "s"} already have strong visual coverage.`;
}

export function runCasaHudMediaPlanning(campaign: CasaHudCampaign): CasaHudMediaPlanData {
  const listings = orderedApprovedListings(campaign);
  if (listings.length === 0 || campaign.scriptSegments.length === 0) {
    return createEmptyCasaHudMediaPlanData();
  }

  const listingAssets = buildListingAssets(campaign, listings);
  const mapLocationAssets = buildMapLocationAssets(campaign);
  const visualAssets = [...listingAssets, ...mapLocationAssets];
  const sceneAssetMapping = buildSceneAssetMappings(campaign, visualAssets);
  const shotList = buildShotList(campaign, sceneAssetMapping);
  const listingImageCoverage = buildListingCoverage(campaign, visualAssets, listings);
  const mapLocationVisualPlan = buildMapLocationVisualPlan(campaign, visualAssets);
  const thumbnailCandidateInputs = buildThumbnailCandidates(campaign, visualAssets, listings);
  const missingMediaWarnings = buildWarnings(campaign, listingImageCoverage, sceneAssetMapping, mapLocationVisualPlan);
  const mediaProviderStatuses = buildProviderStatuses(listingImageCoverage, mapLocationVisualPlan, visualAssets);

  return {
    mediaPlanningStatus: "media_plan_built",
    mediaPlanSummary: buildSummary(campaign, sceneAssetMapping, listingImageCoverage, mapLocationVisualPlan),
    visualAssets,
    sceneAssetMapping,
    shotList,
    listingImageCoverage,
    mapLocationVisualPlan,
    thumbnailCandidateInputs,
    missingMediaWarnings,
    mediaProviderStatuses: mediaProviderStatuses.map((status) => ({
      ...status,
      detail: status.detail,
      warning: status.warning,
    })),
  };
}
