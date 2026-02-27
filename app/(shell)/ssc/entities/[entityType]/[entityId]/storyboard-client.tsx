"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";

type Score = {
  dimension: string;
  score: number;
  reasons: Array<{ title: string; explanation: string; quote: string | null }>;
  flags: string[];
};

type StoryboardRun = {
  id: string;
  url: string;
  screenshot_url?: string;
  scores: Array<{ score_json: Score }>;
  created_at?: string;
};

type LatestResponse = {
  run: StoryboardRun | null;
};

export default function StoryboardClient({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [url, setUrl] = useState("");
  const [latest, setLatest] = useState<StoryboardRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVisibleText, setUploadVisibleText] = useState("");

  function toBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  const fetchLatest = useCallback(async () => {
    const res = await fetch(
      `/api/ssc/storyboard/latest?entity_type=${encodeURIComponent(
        entityType
      )}&entity_id=${encodeURIComponent(entityId)}`
    );
    if (!res.ok) {
      throw new Error(`Failed to load latest run (${res.status})`);
    }
    const payload = (await res.json()) as LatestResponse;
    setLatest(payload.run ?? null);
  }, [entityId, entityType]);

  useEffect(() => {
    fetchLatest().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load")
    );
  }, [fetchLatest]);

  async function generateStoryboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ssc/storyboard/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          url,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
      }
      await fetchLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateFromUpload() {
    if (!uploadFile) return;
    setUploadLoading(true);
    setError(null);
    try {
      const screenshotBase64 = toBase64(await uploadFile.arrayBuffer());
      const res = await fetch("/api/ssc/storyboard/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          url,
          screenshot_base64: screenshotBase64,
          visible_text: uploadVisibleText,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
      }
      await fetchLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload generation failed");
    } finally {
      setUploadLoading(false);
    }
  }

  const scores = useMemo(() => {
    if (!latest?.scores) return [];
    return latest.scores.map((item) => item.score_json);
  }, [latest]);

  return (
    <Tabs.Root defaultValue="storyboard" className="space-y-4">
      <Tabs.List className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2">
        <Tabs.Trigger
          value="storyboard"
          className="rounded-full px-4 py-2 text-sm text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white"
        >
          Storyboard
        </Tabs.Trigger>
        <Tabs.Trigger
          value="notes"
          className="rounded-full px-4 py-2 text-sm text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white"
        >
          Notes
        </Tabs.Trigger>
        <Tabs.Trigger
          value="upload"
          className="rounded-full px-4 py-2 text-sm text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white"
        >
          Upload
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="storyboard" className="space-y-6">
        <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Generate Storyboard
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste entity URL"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <button
              type="button"
              onClick={generateStoryboard}
              disabled={loading || !url}
              className="rounded-full border border-white/10 bg-emerald-400/20 px-5 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate Storyboard"}
            </button>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-rose-300">{error}</p>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                Latest Run
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {latest ? `Run ${latest.id}` : "No storyboard run yet."}
              </p>
            </div>
            {latest?.screenshot_url ? (
              <a
                href={latest.screenshot_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Open screenshot
              </a>
            ) : null}
          </div>

          {latest?.screenshot_url ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <img
                src={latest.screenshot_url}
                alt="Storyboard screenshot"
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {scores.map((score) => (
              <div
                key={score.dimension}
                className="rounded-[20px] border border-white/10 bg-white/4 p-4"
              >
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>{score.dimension}</span>
                  <span className="font-mono text-xs text-emerald-200">{score.score}</span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  {score.reasons.map((reason, index) => (
                    <div key={`${score.dimension}-${index}`}>
                      <div className="font-medium text-slate-200">{reason.title || `Reason ${index + 1}`}</div>
                      <div className="text-slate-400">{reason.explanation}</div>
                      {reason.quote ? (
                        <div className="mt-1 italic text-slate-500">&quot;{reason.quote}&quot;</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {score.flags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {score.flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-300"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">No flags.</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </Tabs.Content>

      <Tabs.Content value="notes">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Use this hub to trigger storyboard runs and review dimension-level
          evidence. Only DOM-rendered text is used for quotes.
        </div>
      </Tabs.Content>

      <Tabs.Content value="upload">
        <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Upload Screenshot + Visible Text
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Use this when Playwright is unavailable on the server.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-slate-100"
            />
            <textarea
              value={uploadVisibleText}
              onChange={(event) => setUploadVisibleText(event.target.value)}
              rows={6}
              placeholder="Paste visible text from the page..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <button
              type="button"
              onClick={generateFromUpload}
              disabled={uploadLoading || !uploadFile}
              className="rounded-full border border-white/10 bg-emerald-400/20 px-5 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadLoading ? "Scoring upload..." : "Score Uploaded Snapshot"}
            </button>
          </div>
        </section>
      </Tabs.Content>
    </Tabs.Root>
  );
}
