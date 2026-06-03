"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent, KeyboardEvent } from "react";

const recentJobColumns = ["Source / File", "Status", "Extracted", "Brains Notified", "Submitted"] as const;

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function FileIqWorkspaceShell() {
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [urlText, setUrlText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setDroppedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const fresh = arr.filter((f) => !existing.has(`${f.name}:${f.size}`));
      return [...prev, ...fresh];
    });
  }, []);

  const removeFile = (index: number) => {
    setDroppedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDropZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBrowseClick();
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const parsedUrls = urlText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const totalQueued = droppedFiles.length + parsedUrls.length;

  return (
    <div className="space-y-4" data-testid="fileiq-workspace-shell">
      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-page-header"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">FileIQ</p>
        <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Command Center</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#475569]">
          Ingest supplier source files to extract canonical product facts for your commerce brains.
        </p>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-ingest-input"
        aria-label="Ingest files or URLs"
      >
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to browse — accepts multiple files"
          data-testid="fileiq-drop-zone"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          onKeyDown={handleDropZoneKeyDown}
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors select-none",
            isDragging
              ? "border-[#1D4ED8] bg-[#DBEAFE]"
              : "border-[#BFDBFE] bg-[#EFF6FF] hover:border-[#93C5FD]",
          ].join(" ")}
        >
          <div
            className={[
              "inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/80 transition-colors",
              isDragging ? "border-[#1D4ED8] text-[#1D4ED8]" : "border-[#BFDBFE] text-[#1D4ED8]",
            ].join(" ")}
          >
            <UploadIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              {isDragging ? "Release to add files" : "Drop files here or click to browse"}
            </p>
            <p className="mt-1 text-xs text-[#475569]">
              Multiple files supported — PDF, DOCX, XLSX, HTML, PNG, JPG, .ai, .tif
            </p>
          </div>
        </div>

        {/* Hidden multi-file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileInput}
        />

        {/* Queued file chips */}
        {droppedFiles.length > 0 && (
          <ul
            className="mt-3 flex flex-wrap gap-2"
            data-testid="fileiq-queued-files"
            aria-label={`${droppedFiles.length} file${droppedFiles.length !== 1 ? "s" : ""} queued`}
          >
            {droppedFiles.map((file, i) => (
              <li
                key={`${file.name}:${file.size}:${i}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]"
              >
                <FileIcon />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  aria-label={`Remove ${file.name}`}
                  className="ml-0.5 rounded p-0.5 text-[#93C5FD] hover:bg-[#DBEAFE] hover:text-[#1D4ED8] focus:outline-none focus:ring-1 focus:ring-[#93C5FD]"
                >
                  <XIcon />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Multi-URL textarea */}
        <div className="mt-3">
          <label htmlFor="fileiq-url-input" className="sr-only">
            URLs to ingest, one per line
          </label>
          <textarea
            id="fileiq-url-input"
            rows={3}
            placeholder={"Paste one or more URLs to ingest, one per line…\nhttps://example.com/catalog.pdf\nhttps://example.com/specs.docx"}
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            aria-label="URLs to ingest, one per line"
            data-testid="fileiq-url-input"
            className="w-full resize-none rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:border-[#93C5FD] focus:outline-none focus:ring-1 focus:ring-[#93C5FD]"
          />
          {parsedUrls.length > 0 && (
            <p className="mt-1 text-xs text-[#475569]" data-testid="fileiq-url-count">
              {parsedUrls.length} URL{parsedUrls.length !== 1 ? "s" : ""} queued
            </p>
          )}
        </div>

        {/* Ingest row */}
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-[#94A3B8]" data-testid="fileiq-ingest-status">
            {totalQueued > 0
              ? `${totalQueued} item${totalQueued !== 1 ? "s" : ""} queued — ingestion wires in Phase 1.2.`
              : "Ingestion is not yet active. Live extraction wires in Phase 1.2."}
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="shrink-0 rounded-lg border border-[#D9E4F0] bg-[#F1F5F9] px-4 py-2 text-sm font-medium text-[#94A3B8] disabled:cursor-not-allowed"
          >
            {totalQueued > 0 ? `Ingest (${totalQueued})` : "Ingest"}
          </button>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-recent-jobs"
        aria-label="Recent ingestion jobs"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">Recent Ingestion Jobs</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fileiq-jobs-table">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {recentJobColumns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B] last:pr-0"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={recentJobColumns.length}
                  className="py-10 text-center text-sm text-[#94A3B8]"
                  data-testid="fileiq-jobs-empty"
                >
                  No ingestion jobs yet. Drop files or paste URLs above to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
