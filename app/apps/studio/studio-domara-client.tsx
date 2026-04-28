"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CasaHudOrchestratorOutput,
  CasaHudStageName,
  CasaHudStageStatus,
} from "@/lib/studio/domara/ai-channel-engine/types";
import type { DomaraIntegrationProviderId, DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";
import {
  buildCasaHudConnectionCards,
  getCasaHudSetupMessage,
  getMissingCasaHudCoreConnections,
  shouldOpenCasaHudSetupForGenerate,
  type CasaHudConnectionCard,
  type CasaHudConnectionCardId,
} from "@/lib/studio/domara/integrations-ui";

type CasaHudRunSummary = {
  id: string;
  status: string;
  current_stage: string;
  selected_title?: string | null;
  project_name?: string | null;
  video_type?: string | null;
  created_at: string;
  updated_at: string;
};

type CasaHudAiStatus = "idle" | "loading" | "ready" | "needs_setup" | "error";

type CasaHudConnectionStatusPayload = {
  ok?: boolean;
  providers?: DomaraIntegrationProviderStatus[];
  saveSupported?: boolean;
};

type CasaHudConnectionSavePayload = {
  ok?: boolean;
  provider?: DomaraIntegrationProviderStatus;
  providers?: DomaraIntegrationProviderStatus[];
  error?: { message?: string };
};

type CasaHudProgressStep = {
  id: string;
  label: string;
  stage?: CasaHudStageName;
};

type CasaHudProgressState = CasaHudStageStatus | "idle";

const wizardSteps: CasaHudProgressStep[] = [
  { id: "youtube_research", stage: "youtube_research", label: "Researching YouTube opportunities" },
  { id: "viral_title", stage: "viral_title", label: "Creating viral titles" },
  { id: "winning_concept", label: "Selecting winning concept" },
  { id: "listing_discovery", stage: "listing_discovery", label: "Finding matching properties" },
  { id: "listing_validation", stage: "listing_validation", label: "Checking listing accuracy" },
  { id: "location_intelligence", stage: "location_intelligence", label: "Gathering local highlights" },
  { id: "script", stage: "script", label: "Writing the story" },
  { id: "storyboard_render_plan", stage: "storyboard_render_plan", label: "Building the video package" },
  { id: "youtube_package", stage: "youtube_package", label: "Preparing for review" },
];

const stageStatusLabel: Record<CasaHudStageStatus, string> = {
  pending: "Waiting",
  running: "Working",
  complete: "Complete",
  needs_credentials: "Connection needed",
  failed: "Needs attention",
  skipped: "Waiting",
};

const progressStatusLabel: Record<CasaHudProgressState, string> = {
  ...stageStatusLabel,
  idle: "Coming up",
};

function statusDotClass(status?: CasaHudProgressState) {
  if (status === "complete") return "bg-[#1B8A5A] shadow-[0_0_0_5px_rgba(27,138,90,0.12)]";
  if (status === "needs_credentials") return "bg-[#B7791F] shadow-[0_0_0_5px_rgba(183,121,31,0.14)]";
  if (status === "failed") return "bg-[#B91C1C] shadow-[0_0_0_5px_rgba(185,28,28,0.14)]";
  if (status === "running") return "bg-[#2563EB] shadow-[0_0_0_5px_rgba(37,99,235,0.14)]";
  return "bg-[#CBD5E1]";
}

function stageTextClass(status?: CasaHudProgressState) {
  if (status === "complete") return "text-[#0F5132]";
  if (status === "needs_credentials") return "text-[#8A4B11]";
  if (status === "failed") return "text-[#991B1B]";
  return "text-[#344256]";
}

function formatVideoType(videoType?: string | null) {
  if (!videoType) return "AI-selected format";
  return videoType
    .split("_")
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ""))
    .join(" ");
}

function getStageStatus(output: CasaHudOrchestratorOutput | null, stageName: CasaHudStageName): CasaHudStageStatus | undefined {
  return output?.stages.find((stage) => stage.name === stageName)?.status;
}

function getPublishingMessage(output: CasaHudOrchestratorOutput | null) {
  const publishingStage = output?.stages.find((stage) => stage.name === "publishing");
  if (!publishingStage?.output || typeof publishingStage.output !== "object") return null;
  const message = (publishingStage.output as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function getProgressStepStatus(
  output: CasaHudOrchestratorOutput | null,
  step: CasaHudProgressStep,
  selectedTitle?: string | null,
): CasaHudProgressState {
  if (step.id === "winning_concept") {
    if (selectedTitle) return "complete";
    const titleStage = getStageStatus(output, "viral_title");
    if (titleStage === "running" || titleStage === "complete") return "running";
    return "idle";
  }

  if (!step.stage) return "idle";
  return getStageStatus(output, step.stage) || "idle";
}

function formatCampaignTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCampaignStatus(status?: string) {
  if (!status) return "Saved";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const providerOptionLabels: Record<DomaraIntegrationProviderId, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  mapbox: "Mapbox",
  google_maps_places: "Google Maps / Places",
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  cloudinary: "Cloudinary",
  digitalocean_spaces: "DigitalOcean Spaces",
  youtube: "YouTube Channel",
};

function defaultProviderForCard(card: CasaHudConnectionCard, providers: DomaraIntegrationProviderStatus[]) {
  if (card.id !== "listing_sources") return card.providerIds[0];
  const connected = providers.find(
    (provider) =>
      card.providerIds.includes(provider.providerId) &&
      provider.configured &&
      provider.validationStatus !== "invalid",
  );
  return connected?.providerId || "idealista";
}

export default function StudioDomaraClient() {
  const [aiStatus, setAiStatus] = useState<CasaHudAiStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<CasaHudOrchestratorOutput | null>(null);
  const [aiRuns, setAiRuns] = useState<CasaHudRunSummary[]>([]);
  const [aiStoreAvailable, setAiStoreAvailable] = useState<boolean | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [connectionProviders, setConnectionProviders] = useState<DomaraIntegrationProviderStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ready" | "error">("loading");
  const [connectionSaveSupported, setConnectionSaveSupported] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<CasaHudConnectionCardId | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<DomaraIntegrationProviderId>("youtube");
  const [connectionSecret, setConnectionSecret] = useState("");
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);

  const latestSavedRun = aiRuns[0];
  const packageReady = Boolean(aiOutput?.youtubePackage);
  const needsConnection = aiOutput?.run.status === "needs_credentials" || aiStatus === "needs_setup";
  const connectionCards = useMemo(() => buildCasaHudConnectionCards(connectionProviders), [connectionProviders]);
  const missingCoreConnections = useMemo(() => getMissingCasaHudCoreConnections(connectionCards), [connectionCards]);
  const setupMessage = useMemo(() => getCasaHudSetupMessage(connectionCards), [connectionCards]);
  const activeConnectionCard = useMemo(
    () => connectionCards.find((card) => card.id === activeConnectionId) || null,
    [activeConnectionId, connectionCards],
  );
  const selectedTitle = aiOutput?.project?.name || aiOutput?.selectedTitle.title || latestSavedRun?.project_name || latestSavedRun?.selected_title;
  const publishingMessage = useMemo(() => getPublishingMessage(aiOutput), [aiOutput]);
  const topTitleCandidates = useMemo(() => aiOutput?.titleCandidates.slice(0, 3) || [], [aiOutput]);
  const selectedListings = useMemo(
    () => aiOutput?.listingValidation?.selectedListings || aiOutput?.listingDiscovery.listings || [],
    [aiOutput],
  );

  const loadConnectionStatus = useCallback(async () => {
    setConnectionStatus("loading");
    try {
      const response = await fetch("/api/studio/domara/integrations/status", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionStatusPayload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error("CasaHUD could not load connection status.");
      }

      const providers = payload.providers || [];
      setConnectionProviders(providers);
      setConnectionSaveSupported(payload.saveSupported !== false);
      setConnectionStatus("ready");
      return providers;
    } catch {
      setConnectionStatus("error");
      setConnectionNotice("CasaHUD could not check your connections. Open setup to try again.");
      return [];
    }
  }, []);

  const loadAiRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/studio/domara/ai-channel/runs", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            runs?: CasaHudRunSummary[];
            latestOutput?: CasaHudOrchestratorOutput | null;
            storeAvailable?: boolean;
            message?: string;
          }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error("CasaHUD could not load saved videos.");
      }

      setAiRuns(payload.runs || []);
      setAiStoreAvailable(Boolean(payload.storeAvailable));
      if (payload.latestOutput) {
        setAiOutput(payload.latestOutput);
        setAiStatus(payload.latestOutput.run.status === "needs_credentials" ? "needs_setup" : "ready");
      } else if (payload.storeAvailable === false) {
        setAiStatus("needs_setup");
        setAiError("CasaHUD is not ready to save video packages in this workspace yet.");
      }
    } catch (runLoadError) {
      setAiStatus("error");
      setAiError(runLoadError instanceof Error ? runLoadError.message : "CasaHUD could not load saved videos.");
    }
  }, []);

  useEffect(() => {
    void loadAiRuns();
  }, [loadAiRuns]);

  useEffect(() => {
    void loadConnectionStatus();
  }, [loadConnectionStatus]);

  function openSetup(reason?: string, focusCardId?: CasaHudConnectionCardId, cardsOverride?: CasaHudConnectionCard[]) {
    setSetupReason(reason || setupMessage);
    setSetupOpen(true);
    setConnectionNotice(null);
    const availableCards = cardsOverride || connectionCards;
    const missingCards = getMissingCasaHudCoreConnections(availableCards);
    const targetCard =
      (focusCardId ? availableCards.find((card) => card.id === focusCardId) : null) ||
      missingCards[0] ||
      availableCards[0];
    if (targetCard) {
      setActiveConnectionId(targetCard.id);
      setActiveProviderId(defaultProviderForCard(targetCard, connectionProviders));
    }
  }

  function openConnectionCard(card: CasaHudConnectionCard) {
    setActiveConnectionId(card.id);
    setActiveProviderId(defaultProviderForCard(card, connectionProviders));
    setConnectionSecret("");
    setConnectionNotice(null);
  }

  async function onSaveConnection() {
    const activeCard = activeConnectionCard;
    if (!activeCard) return;
    if (!connectionSaveSupported) {
      setConnectionNotice("This workspace cannot save new connections here yet. Existing connected services can still be used.");
      return;
    }
    if (!connectionSecret.trim()) {
      setConnectionNotice(`Add the connection key for ${providerOptionLabels[activeProviderId]} before saving.`);
      return;
    }

    try {
      setConnectionSaving(true);
      setConnectionNotice(null);
      const response = await fetch(`/api/studio/domara/integrations/${encodeURIComponent(activeProviderId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionKey: connectionSecret,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CasaHudConnectionSavePayload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "CasaHUD could not save this connection.");
      }
      setConnectionSecret("");
      setConnectionNotice(`${providerOptionLabels[activeProviderId]} is connected.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "CasaHUD could not save this connection.");
    } finally {
      setConnectionSaving(false);
    }
  }

  async function onTestConnection() {
    if (!activeConnectionCard) return;

    try {
      setConnectionTesting(true);
      setConnectionNotice(null);
      const response = await fetch(`/api/studio/domara/integrations/${encodeURIComponent(activeProviderId)}/test`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "CasaHUD could not verify this connection.");
      }
      setConnectionNotice(payload.message || `${providerOptionLabels[activeProviderId]} looks ready.`);
      await loadConnectionStatus();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "CasaHUD could not verify this connection.");
    } finally {
      setConnectionTesting(false);
    }
  }

  async function onGenerateViralVideo() {
    try {
      const currentProviders =
        connectionStatus === "ready" ? connectionProviders : await loadConnectionStatus();
      const currentCards = buildCasaHudConnectionCards(currentProviders);
      if (shouldOpenCasaHudSetupForGenerate(currentCards)) {
        setAiStatus("needs_setup");
        setAiError(null);
        openSetup(
          getCasaHudSetupMessage(currentCards),
          getMissingCasaHudCoreConnections(currentCards)[0]?.id,
          currentCards,
        );
        return;
      }
      if (aiStoreAvailable === false) {
        setAiStatus("needs_setup");
        setAiError("CasaHUD is not ready to save video packages in this workspace yet.");
        return;
      }

      setAiStatus("loading");
      setAiError(null);
      setActionNotice(null);
      setReviewAcknowledged(false);
      const response = await fetch("/api/studio/domara/ai-channel/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredMarket: "Italy real estate YouTube",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            output?: CasaHudOrchestratorOutput;
            providers?: DomaraIntegrationProviderStatus[];
            error?: { message?: string; code?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.output) {
        if (payload?.error?.code === "CONNECTIONS_REQUIRED" && payload.providers) {
          setConnectionProviders(payload.providers);
          const currentCards = buildCasaHudConnectionCards(payload.providers);
          setAiStatus("needs_setup");
          setAiError(null);
          openSetup(
            payload.error.message || getCasaHudSetupMessage(currentCards),
            getMissingCasaHudCoreConnections(currentCards)[0]?.id,
            currentCards,
          );
          return;
        }
        throw new Error(payload?.error?.message || "CasaHUD could not generate a viral video package.");
      }

      if (payload.providers) {
        setConnectionProviders(payload.providers);
      }
      setAiOutput(payload.output);
      setAiStatus(payload.output.run.status === "needs_credentials" ? "needs_setup" : "ready");
      if (payload.output.run.status === "needs_credentials") {
        openSetup("CasaHUD needs a few live connections before it can finish a production video.");
      }
      await loadAiRuns();
    } catch (generationError) {
      setAiStatus("error");
      setAiError(generationError instanceof Error ? generationError.message : "CasaHUD could not generate a viral video package.");
    }
  }

  function onReviewPackage() {
    if (!packageReady) {
      setActionNotice("CasaHUD needs matching properties before review is available.");
      return;
    }
    setReviewAcknowledged(true);
    setActionNotice("Package reviewed. Publishing remains gated by the YouTube connection.");
  }

  function onPublishAction(mode: "publish" | "schedule") {
    if (!packageReady) {
      setActionNotice("Generate a complete video package before publishing.");
      return;
    }
    if (!reviewAcknowledged) {
      setActionNotice("Review the package before publishing or scheduling.");
      return;
    }
    const youtubeCard = connectionCards.find((card) => card.id === "youtube");
    if (!youtubeCard || youtubeCard.status !== "connected") {
      openSetup(
        mode === "publish"
          ? "Connect YouTube before CasaHUD publishes this reviewed package."
          : "Connect YouTube before CasaHUD schedules this reviewed package.",
        "youtube",
      );
      return;
    }
    setActionNotice(
      mode === "publish"
        ? "CasaHUD is ready to publish this reviewed package."
        : "CasaHUD is ready to schedule this reviewed package.",
    );
  }

  const timelineStatus = aiOutput
    ? aiOutput.run.status.replace(/_/g, " ")
    : aiStoreAvailable === false
      ? "setup required"
      : aiStatus === "loading"
        ? "creating"
        : "ready";
  const requiredConnections = connectionCards.filter((card) => card.required);
  const connectedRequiredConnections = requiredConnections.filter(
    (card) => card.status === "connected" || card.status === "partially_connected",
  ).length;
  const attentionConnectionCount = connectionCards.filter((card) => card.status === "needs_attention").length;
  const recentRuns = aiRuns.slice(0, 3);
  const hasRecentCampaigns = recentRuns.length > 0;
  const progressActive = aiStatus === "loading" || Boolean(aiOutput);
  const connectionSummary =
    connectionStatus === "loading"
      ? "Checking connection readiness for CasaHUD."
      : connectionStatus === "error"
        ? "Connection status needs attention. Open Connections to refresh and verify services."
        : attentionConnectionCount > 0
          ? `${attentionConnectionCount} connection${attentionConnectionCount === 1 ? "" : "s"} needs attention.`
          : `${connectedRequiredConnections} of ${requiredConnections.length} core services ready.`;

  return (
    <main className="ibrains-shell min-h-screen overflow-hidden bg-[#ECE7DD] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_78%_2%,rgba(205,142,86,0.24),transparent_32%),linear-gradient(135deg,#F7F1E7_0%,#E9EDF1_52%,#DCE9E1_100%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A5A34]">CasaHUD</p>
            <p className="mt-1 text-sm text-[#657086]">AI real-estate YouTube content engine inside Studio</p>
          </div>
          <Link
            href="/apps"
            className="rounded-full border border-[#CFC4B2] bg-white/70 px-4 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:bg-white"
          >
            Apps
          </Link>
        </div>

        <section
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFDF8]/[0.88] p-6 shadow-[0_28px_75px_rgba(70,55,35,0.18)] backdrop-blur md:p-8"
          data-testid="casahud-entry-hero"
        >
          <div className="absolute right-[-80px] top-[-90px] h-64 w-64 rounded-full bg-[#D59D63]/25 blur-2xl" />
          <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#6C9A84]/[0.18] blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-[#E1D2BC] bg-white/75 px-3 py-1 text-xs font-semibold text-[#8A5A34]">
                Generate → Review → Publish
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#172033] md:text-6xl">
                Generate your next viral property video
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-[#526070] md:text-lg">
                CasaHUD researches winning content angles, finds matching properties, builds the story, and prepares a
                YouTube-ready package.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-[#172033] bg-[#172033] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  onClick={() => void onGenerateViralVideo()}
                  disabled={aiStatus === "loading"}
                  data-testid="casahud-generate-cta"
                >
                  {aiStatus === "loading" ? "Generating Viral Video Title..." : "Generate Viral Video Title"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-[#CFC4B2] bg-white/75 px-5 py-4 text-sm font-semibold text-[#172033] shadow-sm transition hover:bg-white"
                  onClick={() => openSetup()}
                  data-testid="casahud-connections-cta"
                >
                  Connections
                </button>
                <Link
                  href="#recent-campaigns"
                  className="rounded-2xl border border-transparent px-2 py-3 text-sm font-semibold text-[#526070] transition hover:text-[#172033]"
                >
                  Recent Campaigns
                </Link>
              </div>

              <div
                className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E7D8C2] bg-white/[0.58] px-4 py-3 text-sm text-[#526070]"
                data-testid="casahud-connection-summary"
              >
                <span className="font-semibold text-[#172033]">
                  {missingCoreConnections.length === 0 && connectionStatus === "ready" ? "Connected" : "Needs setup"}
                </span>
                <span>{connectionSummary}</span>
              </div>

              {aiError ? (
                <div className="mt-5 rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                  {aiError}
                </div>
              ) : null}
            </div>

            <aside className="rounded-[1.75rem] border border-[#E4D7C2] bg-[linear-gradient(160deg,rgba(250,243,231,0.9),rgba(255,255,255,0.82))] p-5 shadow-[0_20px_45px_rgba(70,55,35,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">
                {selectedTitle ? "Latest campaign" : "How it starts"}
              </p>
              {selectedTitle ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">{selectedTitle}</h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#344256]">
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {formatVideoType(aiOutput?.strategy.videoType || latestSavedRun?.video_type)}
                    </span>
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {packageReady ? "Ready for review" : needsConnection ? "Needs connections" : "In progress"}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#526070]">
                    {needsConnection
                      ? "CasaHUD has the concept ready. Connect the remaining services so it can finish the package with verified property detail."
                      : "CasaHUD keeps the newest title package close at hand so you can move straight into review."}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                    One click creates the next campaign starting point.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[#526070]">
                    CasaHUD begins with the title, then expands it into a story-led package prepared for human review.
                  </p>
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {["Generate", "Review", "Publish"].map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-[#D7CAB8] bg-white/75 px-3 py-1 text-xs font-semibold text-[#344256]"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <section
            id="recent-campaigns"
            className="rounded-[2rem] border border-white/70 bg-[#FBFCF9]/[0.9] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.14)] backdrop-blur md:p-6"
            data-testid="casahud-recent-campaigns"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Recent Campaigns</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Campaign history</h2>
              </div>
              {hasRecentCampaigns ? (
                <span className="rounded-full border border-[#D8E2D9] bg-white/70 px-3 py-1 text-xs font-medium text-[#344256]">
                  {recentRuns.length} recent
                </span>
              ) : null}
            </div>

            {hasRecentCampaigns ? (
              <div className="mt-5 grid gap-3">
                {recentRuns.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-3xl border border-[#E2E8E0] bg-white/[0.82] p-4 shadow-sm"
                    data-testid="casahud-campaign-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold tracking-[-0.02em] text-[#172033]">
                          {run.project_name || run.selected_title || "Untitled CasaHUD campaign"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">
                          {run.video_type ? formatVideoType(run.video_type) : "AI-selected format"} · Updated{" "}
                          {formatCampaignTime(run.updated_at || run.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#D7CAB8] bg-[#F8F3EA] px-3 py-1 text-xs font-semibold text-[#344256]">
                        {formatCampaignStatus(run.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div
                className="mt-5 rounded-[1.75rem] border border-dashed border-[#D8C8B2] bg-[linear-gradient(160deg,rgba(255,249,239,0.9),rgba(255,255,255,0.74))] p-6"
                data-testid="casahud-empty-campaigns"
              >
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">No campaigns yet.</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526070]">
                  Generate your first viral property video title to start a CasaHUD campaign.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-2xl border border-[#172033] bg-[#172033] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.2)] transition hover:bg-[#26324B]"
                  onClick={() => void onGenerateViralVideo()}
                >
                  Generate Viral Video Title
                </button>
              </div>
            )}
          </section>

          <aside
            className="rounded-[2rem] border border-white/70 bg-white/[0.82] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.12)] backdrop-blur md:p-6"
            data-testid="casahud-connections-entry"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Connections</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Service readiness</h2>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-[#CFC4B2] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                onClick={() => openSetup()}
              >
                Manage
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#526070]">
              Manage the services CasaHUD uses for OpenAI, listing sources, maps, local places, media storage, YouTube,
              and optional premium voice.
            </p>

            <div className="mt-4 rounded-2xl border border-[#E7D8C2] bg-[#F8F3EA] px-4 py-3 text-sm text-[#526070]">
              <span className="font-semibold text-[#172033]">Status:</span> {connectionSummary}
            </div>

            <div className="mt-5 grid gap-2">
              {connectionCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DDCD] bg-[#FFFDF8] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172033]">{card.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#718096]">{card.optional ? "Optional later" : "Core service"}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      card.status === "connected" || card.status === "partially_connected"
                        ? "bg-[#DFF3E7] text-[#0F5132]"
                        : card.status === "needs_attention"
                          ? "bg-[#FEE2E2] text-[#991B1B]"
                          : card.status === "optional"
                            ? "bg-[#EEF2F6] text-[#526070]"
                            : "bg-[#FFF0D6] text-[#7A4B13]"
                    }`}
                  >
                    {card.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section
          className="mt-6 rounded-[2rem] border border-white/70 bg-[#F4F7F2]/[0.9] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.12)] backdrop-blur md:p-6"
          data-testid="casahud-progress-shell"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Guided Progress</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
                {progressActive ? "CasaHUD is building the package" : "What happens after you click generate"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]">
                {progressActive
                  ? "The title leads the process. CasaHUD moves step by step toward a review-ready property video package."
                  : "CasaHUD keeps the process guided and productized. It starts with the title, then moves toward review without front-loading setup work."}
              </p>
            </div>
            <span className="rounded-full border border-[#D8E2D9] bg-white/70 px-3 py-1 text-xs font-medium text-[#344256]">
              {timelineStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-2">
              {wizardSteps.map((step) => {
                const status = getProgressStepStatus(aiOutput, step, selectedTitle);
                return (
                  <div
                    key={step.id}
                    className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8E0] bg-white/[0.82] px-3 py-3"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                    <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                    <span className="text-xs text-[#718096]">{progressStatusLabel[status]}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3">
              {topTitleCandidates.length > 0 ? (
                <div className="rounded-3xl border border-[#E4D7C2] bg-[#FFF9EF] p-4">
                  <p className="text-sm font-semibold text-[#172033]">Title directions</p>
                  <div className="mt-3 grid gap-2">
                    {topTitleCandidates.map((candidate) => (
                      <div key={candidate.id} className="rounded-2xl bg-white/75 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-5 text-[#344256]">{candidate.title}</p>
                          <span className="rounded-full bg-[#172033] px-2 py-1 text-[11px] font-semibold text-white">
                            {candidate.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-[#E4D7C2] bg-[#FFF9EF] p-4">
                  <p className="text-sm font-semibold text-[#172033]">Title-first workflow</p>
                  <p className="mt-3 text-sm leading-6 text-[#526070]">
                    CasaHUD starts by shaping a title with strong YouTube potential, then checks the market, property
                    fit, and local story before anything is prepared for review.
                  </p>
                </div>
              )}

              <div className="rounded-3xl border border-[#D8E2D9] bg-white/[0.84] p-4">
                <p className="text-sm font-semibold text-[#172033]">Review comes before publish</p>
                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  CasaHUD prepares the package for human review first. Publishing remains a separate decision after the
                  concept, property backing, and story are checked.
                </p>
              </div>
            </div>
          </div>
        </section>

        {aiOutput?.youtubePackage ? (
          <section className="mt-6 rounded-[2rem] border border-white/70 bg-[#172033] p-5 text-white shadow-[0_24px_64px_rgba(23,32,51,0.24)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D9B383]">Review</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Ready for human review</h2>
              </div>
              <span className="rounded-full border border-white/[0.15] bg-white/10 px-3 py-1 text-xs text-[#E8ECE8]">
                {reviewAcknowledged ? "Reviewed" : "Review required"}
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[#BFC8BF]">Selected title</p>
                <p className="mt-2 text-lg font-semibold leading-6">{aiOutput.youtubePackage.finalRecommendedTitle}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.08] p-3">
                  <p className="text-2xl font-semibold">{selectedListings.length}</p>
                  <p className="mt-1 text-xs text-[#BFC8BF]">properties checked</p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-3">
                  <p className="text-2xl font-semibold">{aiOutput.storyboard?.mapSceneCount || 0}</p>
                  <p className="mt-1 text-xs text-[#BFC8BF]">map scenes</p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-3">
                  <p className="text-2xl font-semibold">{aiOutput.youtubePackage.chapters.length}</p>
                  <p className="mt-1 text-xs text-[#BFC8BF]">chapters</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-[#E8ECE8]">{aiOutput.script?.hook}</p>
              <p className="text-xs leading-5 text-[#BFC8BF]">
                Thumbnail:{" "}
                {aiOutput.youtubePackage.thumbnailIdeas[0]?.visualDirection ||
                  aiOutput.youtubePackage.thumbnailIdeas[0]?.text ||
                  "Prepared with the video package."}
              </p>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-[#172033] transition hover:bg-[#F4EFE6] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onReviewPackage}
                disabled={!packageReady}
              >
                Review
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onPublishAction("publish")}
                disabled={!packageReady}
              >
                Publish Now
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onPublishAction("schedule")}
                disabled={!packageReady}
              >
                Schedule to YouTube
              </button>
            </div>

            {actionNotice || publishingMessage ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-sm leading-6 text-[#E8ECE8]">
                {actionNotice || publishingMessage}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {setupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#172033]/45 p-3 backdrop-blur-sm md:items-center md:justify-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="casahud-connect-title"
          data-testid="casahud-connect-wizard"
        >
          <section className="max-h-[92vh] w-full overflow-y-auto rounded-[1.75rem] border border-white/70 bg-[#FFFDF8] shadow-[0_30px_90px_rgba(23,32,51,0.34)] md:max-w-5xl">
            <div className="border-b border-[#E6D8C6] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A5A34]">Connections</p>
                  <h2 id="casahud-connect-title" className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#172033]">
                    Manage CasaHUD connections
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]" data-testid="casahud-setup-message">
                    {setupReason || setupMessage}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[#D7CAB8] bg-white px-4 py-2 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5]"
                  onClick={() => setSetupOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1.08fr_0.92fr] md:p-6">
              <div className="grid gap-4" data-testid="casahud-connection-cards">
                {[
                  { id: "create", title: "Required to Create Videos" },
                  { id: "publish", title: "Required to Publish/Schedule" },
                  { id: "optional", title: "Optional Premium Upgrade" },
                ].map((group) => (
                  <div key={group.id} className="grid gap-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">{group.title}</p>
                    {connectionCards
                      .filter((card) => card.group === group.id)
                      .map((card) => (
                  <article
                    key={card.id}
                    className={`rounded-2xl border p-4 transition ${
                      activeConnectionId === card.id
                        ? "border-[#172033] bg-white shadow-[0_16px_36px_rgba(23,32,51,0.12)]"
                        : "border-[#E7D8C2] bg-white/[0.72]"
                    }`}
                    data-testid={`casahud-connection-card-${card.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#172033]">{card.title}</h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              card.status === "connected" || card.status === "partially_connected"
                                ? "bg-[#DFF3E7] text-[#0F5132]"
                                : card.status === "needs_attention"
                                  ? "bg-[#FEE2E2] text-[#991B1B]"
                                  : card.status === "optional"
                                    ? "bg-[#EEF2F6] text-[#526070]"
                                    : "bg-[#FFF0D6] text-[#7A4B13]"
                            }`}
                          >
                            {card.statusLabel}
                          </span>
                          {card.optional ? (
                            <span className="rounded-full bg-[#EEF2F6] px-2.5 py-1 text-xs font-semibold text-[#526070]">
                              Optional
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#EAF0FF] px-2.5 py-1 text-xs font-semibold text-[#274690]">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#526070]">{card.enables}</p>
                        <p className="mt-1 text-xs leading-5 text-[#718096]">{card.detail}</p>
                        {card.supportedSourceLabels ? (
                          <p className="mt-2 text-xs font-medium leading-5 text-[#526070]">
                            {card.supportedSourceLabels.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="rounded-xl border border-[#CFC4B2] bg-[#172033] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#26324B]"
                        onClick={() => openConnectionCard(card)}
                      >
                        {card.ctaLabel}
                      </button>
                    </div>
                  </article>
                      ))}
                  </div>
                ))}
              </div>

              <aside className="rounded-2xl border border-[#E7D8C2] bg-[#F9F4EC] p-4" data-testid="casahud-connection-form">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Connection setup</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#172033]">
                      {activeConnectionCard?.title || "Choose a connection"}
                    </h3>
                  </div>
                  {activeConnectionCard ? (
                    <span className="rounded-full border border-[#D7CAB8] bg-white px-3 py-1 text-xs font-semibold text-[#526070]">
                      {activeConnectionCard.optional ? "Optional" : "Required"}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-6 text-[#526070]">
                  Add or update the connection key for this service. CasaHUD protects it for your account and never
                  shows the full value back on screen.
                </p>

                {activeConnectionCard?.id === "listing_sources" || activeConnectionCard?.id === "media_storage" ? (
                  <label className="mt-4 block text-sm font-semibold text-[#344256]">
                    {activeConnectionCard.id === "listing_sources" ? "Listing source" : "Storage provider"}
                    <select
                      className="mt-2 w-full rounded-xl border border-[#D7CAB8] bg-white px-3 py-3 text-sm text-[#172033] outline-none transition focus:border-[#172033]"
                      value={activeProviderId}
                      onChange={(event) => setActiveProviderId(event.target.value as DomaraIntegrationProviderId)}
                    >
                      {activeConnectionCard.providerIds.map((providerId) => (
                        <option key={providerId} value={providerId}>
                          {providerOptionLabels[providerId]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="mt-4 block text-sm font-semibold text-[#344256]">
                  Connection key
                  <input
                    className="mt-2 w-full rounded-xl border border-[#D7CAB8] bg-white px-3 py-3 text-sm text-[#172033] outline-none transition placeholder:text-[#98A1AE] focus:border-[#172033]"
                    type="password"
                    value={connectionSecret}
                    onChange={(event) => setConnectionSecret(event.target.value)}
                    placeholder={`Paste ${providerOptionLabels[activeProviderId]} connection key`}
                    autoComplete="off"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[#172033] bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onSaveConnection()}
                    disabled={connectionSaving || !activeConnectionCard}
                  >
                    {connectionSaving ? "Saving..." : "Save Connection"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#CFC4B2] bg-white px-4 py-3 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onTestConnection()}
                    disabled={connectionTesting || !activeConnectionCard}
                  >
                    {connectionTesting ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#CFC4B2] bg-white px-4 py-3 text-sm font-semibold text-[#344256] transition hover:bg-[#F8F0E5]"
                    onClick={() => void loadConnectionStatus()}
                  >
                    Refresh Status
                  </button>
                </div>

                {connectionNotice ? (
                  <p className="mt-4 rounded-xl border border-[#E1D2BC] bg-white p-3 text-sm leading-6 text-[#526070]">
                    {connectionNotice}
                  </p>
                ) : null}

                <div className="mt-5 rounded-2xl border border-[#E1D2BC] bg-white p-4">
                  <p className="text-sm font-semibold text-[#172033]">Production checklist</p>
                  <div className="mt-3 grid gap-2 text-sm text-[#526070]">
                    {connectionCards
                      .filter((card) => card.required)
                      .map((card) => (
                        <div key={card.id} className="flex items-center justify-between gap-3">
                          <span>{card.title}</span>
                          <span className={card.status === "connected" || card.status === "partially_connected" ? "font-semibold text-[#0F5132]" : "font-semibold text-[#7A4B13]"}>
                            {card.status === "connected" || card.status === "partially_connected" ? card.statusLabel : "Needed"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
