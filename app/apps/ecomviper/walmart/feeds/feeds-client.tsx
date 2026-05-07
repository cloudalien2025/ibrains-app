"use client";

import { useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import type { WalmartFeedSubmission } from "@/lib/ecomviper/walmart/walmart-types";

interface FeedsClientProps {
  initialFeeds: WalmartFeedSubmission[];
  mode: string;
}

export default function WalmartFeedsClient({ initialFeeds, mode }: FeedsClientProps) {
  const [feeds, setFeeds] = useState(initialFeeds);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState<string | null>(null);

  async function submitFeed() {
    const response = await fetch("/api/ecomviper/walmart/feeds/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "OPA-OMEGA3-120" }),
    });

    if (!response.ok) {
      setMessage("Feed submit failed.");
      return;
    }

    const payload = (await response.json()) as { submission: WalmartFeedSubmission; message: string };
    setFeeds((current) => [payload.submission, ...current]);
    setMessage(payload.message);
  }

  async function checkStatus(feedId: string) {
    const response = await fetch(`/api/ecomviper/walmart/feeds/status?feedId=${encodeURIComponent(feedId)}`);
    if (!response.ok) {
      setMessage("Unable to check status.");
      return;
    }

    const payload = (await response.json()) as { submission: WalmartFeedSubmission };
    setFeeds((current) => current.map((entry) => (entry.feedId === feedId ? payload.submission : entry)));
    setMessage(`Feed ${feedId} status: ${payload.submission.status}`);
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-feeds-page">
      <WalmartPageHeader
        title="Feeds"
        subtitle="Submit maintenance feeds, track status, and review payload/error history safely."
        mode={mode}
        actions={
          <button type="button" onClick={submitFeed} className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white">
            Submit maintenance feed
          </button>
        }
      />

      {message ? <p className="rounded-lg border border-[#D9E4F0] bg-white/95 px-3 py-2 text-sm text-[#334155]">{message}</p> : null}

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Feed ID</th>
                <th className="py-2">Feed type</th>
                <th className="py-2">Status</th>
                <th className="py-2">Submitted at</th>
                <th className="py-2">Completed at</th>
                <th className="py-2">Error count</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.id} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2 font-mono text-xs text-[#334155]">{feed.feedId}</td>
                  <td className="py-2 pr-2 text-[#334155]">{feed.feedType}</td>
                  <td className="py-2 pr-2"><StatusBadge status={feed.status} /></td>
                  <td className="py-2 pr-2 text-[#334155]">{feed.submittedAt}</td>
                  <td className="py-2 pr-2 text-[#334155]">{feed.completedAt ?? "Pending"}</td>
                  <td className="py-2 pr-2 text-[#334155]">{feed.errorReport.length}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => checkStatus(feed.feedId)} className="text-xs text-[#2563EB]">Check feed status</button>
                      <button type="button" onClick={() => setPreviewPayload(JSON.stringify(feed.submittedPayload, null, 2))} className="text-xs text-[#2563EB]">Preview payload</button>
                      <button type="button" onClick={() => setPreviewPayload(JSON.stringify(feed.errorReport, null, 2))} className="text-xs text-[#2563EB]">View feed errors</button>
                      <button type="button" onClick={() => setPreviewPayload(JSON.stringify(feed.submittedPayload, null, 2))} className="text-xs text-[#2563EB]">Download payload</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previewPayload ? (
        <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Feed payload/error preview</h2>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#F8FBFF] p-3 text-xs text-[#334155]">{previewPayload}</pre>
        </section>
      ) : null}
    </div>
  );
}
