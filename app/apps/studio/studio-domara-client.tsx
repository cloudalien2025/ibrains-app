"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CasaHudOrchestratorOutput,
  CasaHudStageName,
  CasaHudStageStatus,
} from "@/lib/studio/domara/ai-channel-engine/types";

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

const wizardSteps: Array<{ stage: CasaHudStageName; label: string }> = [
  { stage: "youtube_research", label: "Finding high-potential video ideas" },
  { stage: "viral_title", label: "Creating viral title" },
  { stage: "listing_discovery", label: "Finding matching properties" },
  { stage: "listing_validation", label: "Checking listing accuracy" },
  { stage: "location_intelligence", label: "Adding maps and local highlights" },
  { stage: "script", label: "Writing the story" },
  { stage: "storyboard_render_plan", label: "Building the video package" },
  { stage: "youtube_package", label: "Preparing for review" },
  { stage: "review", label: "Ready to publish or schedule" },
];

const stageStatusLabel: Record<CasaHudStageStatus, string> = {
  pending: "Waiting",
  running: "Working",
  complete: "Complete",
  needs_credentials: "Connection needed",
  failed: "Needs attention",
  skipped: "Waiting",
};

function statusDotClass(status?: CasaHudStageStatus) {
  if (status === "complete") return "bg-[#1B8A5A] shadow-[0_0_0_5px_rgba(27,138,90,0.12)]";
  if (status === "needs_credentials") return "bg-[#B7791F] shadow-[0_0_0_5px_rgba(183,121,31,0.14)]";
  if (status === "failed") return "bg-[#B91C1C] shadow-[0_0_0_5px_rgba(185,28,28,0.14)]";
  if (status === "running") return "bg-[#2563EB] shadow-[0_0_0_5px_rgba(37,99,235,0.14)]";
  return "bg-[#CBD5E1]";
}

function stageTextClass(status?: CasaHudStageStatus) {
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

export default function StudioDomaraClient() {
  const [aiStatus, setAiStatus] = useState<CasaHudAiStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<CasaHudOrchestratorOutput | null>(null);
  const [aiRuns, setAiRuns] = useState<CasaHudRunSummary[]>([]);
  const [aiStoreAvailable, setAiStoreAvailable] = useState<boolean | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const latestSavedRun = aiRuns[0];
  const packageReady = Boolean(aiOutput?.youtubePackage);
  const needsConnection = aiOutput?.run.status === "needs_credentials" || aiStatus === "needs_setup";
  const selectedTitle = aiOutput?.project?.name || aiOutput?.selectedTitle.title || latestSavedRun?.project_name || latestSavedRun?.selected_title;
  const publishingMessage = useMemo(() => getPublishingMessage(aiOutput), [aiOutput]);
  const topTitleCandidates = useMemo(() => aiOutput?.titleCandidates.slice(0, 3) || [], [aiOutput]);
  const selectedListings = useMemo(
    () => aiOutput?.listingValidation?.selectedListings || aiOutput?.listingDiscovery.listings || [],
    [aiOutput],
  );

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
        setAiError("CasaHUD needs storage setup before it can save video packages.");
      }
    } catch (runLoadError) {
      setAiStatus("error");
      setAiError(runLoadError instanceof Error ? runLoadError.message : "CasaHUD could not load saved videos.");
    }
  }, []);

  useEffect(() => {
    void loadAiRuns();
  }, [loadAiRuns]);

  async function onGenerateViralVideo() {
    try {
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
            error?: { message?: string; code?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.output) {
        throw new Error(payload?.error?.message || "CasaHUD could not generate a viral video package.");
      }

      setAiOutput(payload.output);
      setAiStatus(payload.output.run.status === "needs_credentials" ? "needs_setup" : "ready");
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
    setActionNotice(
      mode === "publish"
        ? "Connect YouTube before CasaHUD can publish this reviewed package."
        : "Connect YouTube before CasaHUD can schedule this reviewed package.",
    );
  }

  const timelineStatus = aiOutput
    ? aiOutput.run.status.replace(/_/g, " ")
    : aiStoreAvailable === false
      ? "setup required"
      : aiStatus === "loading"
        ? "creating"
        : "ready";

  return (
    <main className="ibrains-shell min-h-screen overflow-hidden bg-[#ECE7DD] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_78%_2%,rgba(205,142,86,0.24),transparent_32%),linear-gradient(135deg,#F7F1E7_0%,#E9EDF1_52%,#DCE9E1_100%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A5A34]">CasaHUD</p>
            <p className="mt-1 text-sm text-[#657086]">AI YouTube Creator for real-estate videos</p>
          </div>
          <Link
            href="/apps"
            className="rounded-full border border-[#CFC4B2] bg-white/70 px-4 py-2 text-sm font-medium text-[#344256] shadow-sm transition hover:bg-white"
          >
            Apps
          </Link>
        </div>

        <section className="mt-6 grid flex-1 gap-5 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[#FFFDF8]/[0.88] p-6 shadow-[0_28px_75px_rgba(70,55,35,0.18)] backdrop-blur md:p-8">
            <div className="absolute right-[-80px] top-[-90px] h-64 w-64 rounded-full bg-[#D59D63]/25 blur-2xl" />
            <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#6C9A84]/[0.18] blur-2xl" />
            <div className="relative">
              <div className="inline-flex rounded-full border border-[#E1D2BC] bg-white/75 px-3 py-1 text-xs font-semibold text-[#8A5A34]">
                One click from idea to review-ready YouTube package
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#172033] md:text-6xl">
                Create the next viral property video without building it by hand.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#526070] md:text-lg">
                CasaHUD researches the opportunity, chooses the strongest title, finds matching properties, adds local
                intelligence, writes the story, prepares the render plan, and holds the finished package for review.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-[#172033] bg-[#172033] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(23,32,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#26324B] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  onClick={() => void onGenerateViralVideo()}
                  disabled={aiStatus === "loading" || aiStoreAvailable === false}
                >
                  {aiStatus === "loading" ? "Generating..." : "Generate Viral Video"}
                </button>
                <p className="max-w-sm text-sm leading-6 text-[#657086]">
                  The winning YouTube title automatically becomes the project name.
                </p>
              </div>

              {aiError ? (
                <div className="mt-5 rounded-2xl border border-[#D8B26A] bg-[#FFF5DA] p-4 text-sm text-[#7A4B13]">
                  {aiError}
                </div>
              ) : null}

              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {["YouTube-informed ideas", "Real listing checks", "Maps and local highlights"].map((label) => (
                  <div key={label} className="rounded-2xl border border-[#E8DDCD] bg-white/[0.66] p-4">
                    <p className="text-sm font-semibold text-[#172033]">{label}</p>
                    <p className="mt-2 text-xs leading-5 text-[#657086]">
                      {label === "YouTube-informed ideas"
                        ? "Uses live channel signals when connected, otherwise uses CasaHUD strategy rules."
                        : label === "Real listing checks"
                          ? "Only advances when sourced property data supports the promise."
                          : "Location context shapes the hook, scenes, metadata, and thumbnail angle."}
                    </p>
                  </div>
                ))}
              </div>

              {selectedTitle ? (
                <div className="mt-5 rounded-3xl border border-[#E4D7C2] bg-[#FAF3E7]/[0.78] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">Current video</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#172033]">{selectedTitle}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-[#344256]">
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {formatVideoType(aiOutput?.strategy.videoType || latestSavedRun?.video_type)}
                    </span>
                    <span className="rounded-full border border-[#D7CAB8] bg-white/70 px-3 py-1">
                      {packageReady ? "Package ready for review" : needsConnection ? "Connection needed" : "Saved"}
                    </span>
                  </div>
                  {needsConnection ? (
                    <p className="mt-3 text-sm leading-6 text-[#7A4B13]">
                      CasaHUD has created the title and project. Connect listing sources before it can select real
                      properties and complete the video package.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-white/70 bg-[#FBFCF9]/[0.88] p-5 shadow-[0_24px_64px_rgba(70,55,35,0.14)] backdrop-blur md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7B6D]">Creation status</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172033]">Production timeline</h2>
                </div>
                <span className="rounded-full border border-[#D8E2D9] bg-white/70 px-3 py-1 text-xs font-medium text-[#344256]">
                  {timelineStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-2">
                {wizardSteps.map((step) => {
                  const status = getStageStatus(aiOutput, step.stage);
                  return (
                    <div
                      key={step.stage}
                      className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8E0] bg-white/[0.72] px-3 py-3"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                      <span className={`text-sm font-medium ${stageTextClass(status)}`}>{step.label}</span>
                      <span className="text-xs text-[#718096]">{status ? stageStatusLabel[status] : "Waiting"}</span>
                    </div>
                  );
                })}
              </div>

              {topTitleCandidates.length > 0 ? (
                <div className="mt-5 rounded-3xl border border-[#E4D7C2] bg-[#FFF9EF] p-4">
                  <p className="text-sm font-semibold text-[#172033]">Top title ideas</p>
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
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-[#172033] p-5 text-white shadow-[0_24px_64px_rgba(23,32,51,0.24)] md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D9B383]">Review room</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                    {packageReady ? "Ready for human review" : "Waiting for a complete package"}
                  </h2>
                </div>
                <span className="rounded-full border border-white/[0.15] bg-white/10 px-3 py-1 text-xs text-[#E8ECE8]">
                  {reviewAcknowledged ? "Reviewed" : "Review required"}
                </span>
              </div>

              {aiOutput?.youtubePackage ? (
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
              ) : (
                <p className="mt-5 text-sm leading-6 text-[#D7DED6]">
                  CasaHUD will show the hook, title, storyboard, render plan, thumbnail idea, description, tags, and
                  publishing metadata here once real listing evidence is available.
                </p>
              )}

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
          </aside>
        </section>
      </div>
    </main>
  );
}
