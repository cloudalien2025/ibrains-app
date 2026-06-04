"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FileIqJobActionsProps = {
  jobId: string;
  jobLabel: string;
  status: string;
  schemaType?: string | null;
  theme?: "dark" | "light";
  onDeleted?: (jobId: string) => void;
};

const SUPPORTED_DOWNLOAD_SCHEMAS = new Set(["product_catalog", "financial_statement"]);

function isDownloadSupported(schemaType?: string | null): boolean {
  return typeof schemaType === "string" && SUPPORTED_DOWNLOAD_SCHEMAS.has(schemaType);
}

function buttonStyle(theme: "dark" | "light", tone: "primary" | "danger" | "neutral", disabled: boolean) {
  if (theme === "light") {
    const base = {
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 12,
      border: "1px solid #CBD5E1",
      background: "#FFFFFF",
      color: "#0F172A",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
    } as const;
    if (tone === "primary") return { ...base, border: "1px solid #BFDBFE", color: "#1D4ED8", background: "#EFF6FF" };
    if (tone === "danger") return { ...base, border: "1px solid #FECACA", color: "#B91C1C", background: "#FEF2F2" };
    return base;
  }

  const base = {
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 11,
    border: "1px solid rgba(80,140,200,.18)",
    background: "rgba(10,18,36,.76)",
    color: "#D8E5F6",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  } as const;
  if (tone === "primary") return { ...base, border: "1px solid rgba(0,212,255,.25)", color: "#7DD3FC" };
  if (tone === "danger") return { ...base, border: "1px solid rgba(255,80,112,.28)", color: "#FDA4AF" };
  return base;
}

export default function FileIqJobActions({
  jobId,
  jobLabel,
  status,
  schemaType,
  theme = "light",
  onDeleted,
}: FileIqJobActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canDelete = status !== "pending" && status !== "running";
  const canDownload = status === "completed" && isDownloadSupported(schemaType);
  const disabledReason = !canDelete
    ? "Delete becomes available after processing finishes."
    : status !== "completed"
      ? "Download becomes available after the job completes successfully."
      : status === "completed" && !canDownload
      ? "A downloadable PDF report is not available for this completed job yet."
      : null;

  async function handleDownload(): Promise<void> {
    if (!canDownload || isDownloading) return;
    setIsDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/fileiq/jobs/${jobId}/download`, {
        method: "GET",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage(payload.message ?? "Download failed.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(disposition);
      const fileName = match?.[1] ?? `${jobId}-report.pdf`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!canDelete || isDeleting) return;
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`Delete "${jobLabel}" permanently? This will remove the job, source files, and stored results.`)
        : true;
    if (!confirmed) return;

    setIsDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/fileiq/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage(payload.message ?? "Delete failed.");
        return;
      }

      if (onDeleted) {
        onDeleted(jobId);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Delete failed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: theme === "light" ? "flex-end" : "flex-start", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: theme === "light" ? "flex-end" : "flex-start" }}>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!canDownload || isDownloading || isDeleting}
          title={!canDownload ? disabledReason ?? "Download unavailable." : "Download PDF report"}
          style={buttonStyle(theme, "primary", !canDownload || isDownloading || isDeleting)}
        >
          {isDownloading ? "Preparing..." : "Download"}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={!canDelete || isDeleting || isDownloading}
          title={!canDelete ? disabledReason ?? "Delete unavailable." : "Delete job"}
          style={buttonStyle(theme, "danger", !canDelete || isDeleting || isDownloading)}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
      {message ? (
        <p
          role="alert"
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: theme === "light" ? "#B91C1C" : "#FDA4AF",
            maxWidth: 240,
            textAlign: theme === "light" ? "right" : "left",
          }}
        >
          {message}
        </p>
      ) : disabledReason ? (
        <p
          style={{
            fontSize: 10,
            lineHeight: 1.4,
            color: theme === "light" ? "#64748B" : "#8AAFD4",
            maxWidth: 240,
            textAlign: theme === "light" ? "right" : "left",
          }}
        >
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
