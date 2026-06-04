"use client";

import { useState } from "react";

export default function RocktomicSourceSyncTrigger({
  className,
}: {
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("running");
    setMessage(null);
    try {
      const response = await fetch("/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        syncStatus?: string;
        lastSyncError?: string | null;
        error?: { message?: string };
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error?.message || "Could not run supplier source sync.");
      }
      setStatus("success");
      if (body.syncStatus === "sync_failed" || body.syncStatus === "source_inaccessible" || body.syncStatus === "source_auth_required") {
        setMessage(body.lastSyncError || `Sync completed with status: ${body.syncStatus}`);
      } else {
        setMessage(`Sync completed with status: ${body.syncStatus || "synced"}.`);
      }
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not run supplier source sync.");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSync}
        disabled={status === "running"}
        className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
      >
        {status === "running" ? "Running Source Sync..." : "Run Source Sync"}
      </button>
      {message ? (
        <p className={`mt-2 text-xs ${status === "error" ? "text-rose-700" : "text-[#334155]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
