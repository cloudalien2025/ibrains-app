"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = { slot_id: string; focus_keyword: string; location_modifier?: string };

type StatusItem = {
  slot_id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cache_id: string;
  error_message?: string | null;
  serp_query_used?: string;
  top_results?: Array<{ title: string; link: string }>;
  consensus_outline?: { h2Sections: Array<{ heading: string; h3: string[] }> } | null;
};

const listing = {
  listing_id: "listing-1",
  business_name: "DirectoryIQ Demo Listing",
  city: "Austin",
  state: "TX",
  listing_url: "https://example.com/listing-1",
};

const slots: Slot[] = [
  { slot_id: "slot-1", focus_keyword: "roof repair", location_modifier: "Austin TX" },
  { slot_id: "slot-2", focus_keyword: "emergency plumber", location_modifier: "Austin TX" },
];

const labelFromStatus = (status: StatusItem["status"]): string => {
  if (status === "READY") return "SERP: Ready";
  if (status === "FAILED") return "SERP: Failed";
  return "SERP: Preparing…";
};

export default function DirectoryIqAuthoritySupportPage() {
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      await fetch("/api/directoryiq/authority-support/serp-outline/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listing.listing_id, slots }),
      });

      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        const response = await fetch(`/api/directoryiq/authority-support/serp-outline/status?listing_id=${listing.listing_id}`);
        const data = (await response.json()) as { items: StatusItem[] };
        setStatusItems(data.items);
        const allDone = data.items.every((item) => item.status === "READY" || item.status === "FAILED");
        if (allDone || tries >= 15) clearInterval(timer);
      }, 2000);
      return () => clearInterval(timer);
    };

    bootstrap();
  }, []);

  const statusBySlot = useMemo(() => new Map(statusItems.map((item) => [item.slot_id, item])), [statusItems]);

  const generateDraft = async (slot: Slot) => {
    const status = statusBySlot.get(slot.slot_id);
    const response = await fetch("/api/directoryiq/blog-drafts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing: { ...listing, slot_id: slot.slot_id },
        focus_keyword: slot.focus_keyword,
        serp_cache_id: status?.status === "READY" ? status.cache_id : null,
      }),
    });
    const data = (await response.json()) as { draft_id: string };
    setDraftId(data.draft_id);
    router.push(`/directoryiq/blog-drafts/${data.draft_id}/preview`);
  };

  return (
    <main style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>DirectoryIQ Authority Support</h1>
      {slots.map((slot) => {
        const status = statusBySlot.get(slot.slot_id);
        return (
          <section key={slot.slot_id} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
            <h2>{slot.focus_keyword}</h2>
            <div>{status ? labelFromStatus(status.status) : "SERP: Preparing…"}</div>
            <button onClick={() => generateDraft(slot)} style={{ marginTop: 8 }}>
              {status?.status === "READY" ? "Generate Draft (SERP Ready)" : "Generate Draft (Fast)"}
            </button>
            {draftId && <p>Latest draft: {draftId}</p>}
            {status?.status === "READY" && (
              <details style={{ marginTop: 8 }}>
                <summary>SERP Details</summary>
                <p>Query: {status.serp_query_used}</p>
                <ul>
                  {(status.top_results ?? []).map((result) => (
                    <li key={result.link}>
                      {result.title} ({new URL(result.link).hostname})
                    </li>
                  ))}
                </ul>
                <h4>Consensus outline</h4>
                <ul>
                  {(status.consensus_outline?.h2Sections ?? []).map((section) => (
                    <li key={section.heading}>{section.heading}</li>
                  ))}
                </ul>
              </details>
            )}
            {status?.status === "FAILED" && <p style={{ color: "red" }}>{status.error_message}</p>}
          </section>
        );
      })}
    </main>
  );
}
