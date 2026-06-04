"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  bundleId: string;
  bundleName: string;
  status: string;
  summary: Record<string, unknown>;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Static source intelligence map ───────────────────────────────────────────

const SOURCES = [
  { name: "Supplement PDF",  truth: "Facts · Certifications · Category", color: "#10D9A0" },
  { name: "Inventory CSV",   truth: "Stock Status · Access Level",        color: "#6B8CFF" },
  { name: "MSRP Report",     truth: "Pricing · Wholesale Tiers",          color: "#FFAD33" },
  { name: "PLDS Catalog",    truth: "Dimensions · Weight",                color: "#C084FC" },
  { name: "Shipping Policy", truth: "Carriers · Transit · Returns",       color: "#FB7185" },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  completed: { label: "Completed",  color: "#10D9A0", bg: "rgba(16,217,160,.07)",  border: "rgba(16,217,160,.22)" },
  running:   { label: "Processing", color: "#FFAD33", bg: "rgba(255,173,51,.07)",  border: "rgba(255,173,51,.22)"  },
  failed:    { label: "Failed",     color: "#FF5070", bg: "rgba(255,80,112,.07)",   border: "rgba(255,80,112,.22)"  },
  pending:   { label: "Pending",    color: "#4A6A8A", bg: "transparent",            border: "rgba(42,58,85,.35)"    },
  unavailable: { label: "Unavailable", color: "#FFAD33", bg: "rgba(255,173,51,.07)", border: "rgba(255,173,51,.22)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractedCount(job: JobRow): number {
  const n = job.summary?.totalProductsFound;
  return typeof n === "number" ? n : 0;
}

function schemaLabel(job: JobRow): string {
  const t = job.summary?.schemaType;
  const v = job.summary?.schemaVersion;
  if (t !== "product_catalog") return "—";
  return `product_catalog ${typeof v === "string" ? `v${v}` : ""}`.trim();
}

function supplierName(job: JobRow): string {
  const value = job.summary?.supplierName;
  return typeof value === "string" && value.trim() ? value.trim() : "Unknown Supplier";
}

function validationLabel(job: JobRow): string {
  const agentStatus = job.summary?.agentStatus;
  if (agentStatus === "fallback_deterministic") return "Parsed only";
  if (agentStatus === "completed") return "Validated";
  return "—";
}

function jobDuration(job: JobRow): string {
  if (!job.completedAt || !job.createdAt) return "—";
  try {
    const ms = new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime();
    if (ms < 0) return "—";
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    return `${(ms / 3_600_000).toFixed(1)}h`;
  } catch {
    return "—";
  }
}

function relativeTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "Just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function latestSchemaVersion(jobs: JobRow[]): string {
  for (const j of jobs) {
    if (j.summary?.schemaType === "product_catalog" && typeof j.summary?.schemaVersion === "string") {
      return `v${j.summary.schemaVersion}`;
    }
  }
  return "v1.1";
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const FILEIQ_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.fileiq-root {
  --bg: #04060F;
  --c1: #00D4FF;
  --c3: #10D9A0;
  --c2: #7B5EA7;
  --amber: #FFAD33;
  --red: #FF5070;
  --glass: rgba(10,16,32,0.72);
  --glass-b: rgba(80,160,220,0.10);
  --t1: #E0EAFF;
  --t2: #8AAFD4;
  --t3: #4A6A8A;
  --display: 'Bricolage Grotesque', sans-serif;
  --mono: 'Azeret Mono', monospace;
  --body: 'Plus Jakarta Sans', sans-serif;
  min-height: 100vh;
  background: var(--bg);
  color: var(--t1);
  font-family: var(--body);
  overflow-x: hidden;
  position: relative;
}

@keyframes fiq-aurora1  { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 50%{transform:translate(-30px,20px) scale(1.15);opacity:.85} }
@keyframes fiq-aurora2  { 0%,100%{transform:translate(0,0) scale(1);opacity:.45} 50%{transform:translate(40px,-15px) scale(1.1);opacity:.65} }
@keyframes fiq-aurora3  { 0%,100%{transform:translate(0,0) scale(1);opacity:.3} 50%{transform:translate(-20px,-30px) scale(1.08);opacity:.5} }
@keyframes fiq-breathe  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
@keyframes fiq-spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes fiq-spinR    { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
@keyframes fiq-blink    { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes fiq-pulseRing{ 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.7);opacity:0} }
@keyframes fiq-fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes fiq-shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }

.fiq-glass {
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-b);
}
.fiq-grad-border { position: relative; }
.fiq-grad-border::before {
  content:''; position:absolute; inset:0; border-radius:inherit; padding:1px;
  background: linear-gradient(135deg, rgba(0,212,255,.32), rgba(123,94,167,.22), rgba(16,217,160,.18));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events:none;
}
.fiq-sl {
  font-family: var(--display); font-size: 10px; font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase; color: rgba(80,120,170,0.7);
  white-space: nowrap;
}

.fiq-upload-orb {
  position: relative; border-radius: 50%; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  transition: transform .3s ease; flex-shrink: 0;
  width: 170px; height: 170px;
}
@media (min-width: 640px) { .fiq-upload-orb { width: 210px; height: 210px; } }
.fiq-upload-orb:hover { transform: scale(1.05); }
.fiq-upload-orb.drag  { transform: scale(1.09); }
.fiq-orb-core {
  position:absolute; inset:0; border-radius:50%;
  background: radial-gradient(circle at 35% 35%, rgba(0,212,255,.18), rgba(16,217,160,.09), transparent 70%);
  border: 1px solid rgba(0,212,255,.22);
  animation: fiq-breathe 4s ease-in-out infinite;
}
.fiq-orb-r1 {
  position:absolute; inset:-12px; border-radius:50%;
  border:1px solid rgba(0,212,255,.13);
  animation: fiq-spin 11s linear infinite;
}
.fiq-orb-r1::before {
  content:''; position:absolute; width:7px; height:7px; background:var(--c1);
  border-radius:50%; top:50%; left:-3.5px; transform:translateY(-50%);
  box-shadow:0 0 10px var(--c1);
}
.fiq-orb-r2 {
  position:absolute; inset:-22px; border-radius:50%;
  border:1px solid rgba(123,94,167,.09);
  animation: fiq-spinR 19s linear infinite;
}
.fiq-orb-r2::before {
  content:''; position:absolute; width:5px; height:5px; background:var(--c2);
  border-radius:50%; top:-2.5px; left:50%; transform:translateX(-50%);
  box-shadow:0 0 8px var(--c2);
}
.fiq-orb-pulse { position:absolute; inset:0; border-radius:50%; border:2px solid rgba(0,212,255,.35); animation:fiq-pulseRing 2.8s ease-out infinite; }

.fiq-ai-input {
  background: rgba(6,12,26,.85); border:1px solid rgba(80,140,200,.12);
  color:var(--t1); font-family:var(--body); font-size:14px; outline:none; width:100%;
  transition:border-color .2s, box-shadow .2s; border-radius:8px;
}
.fiq-ai-input:focus { border-color:rgba(0,212,255,.4); box-shadow:0 0 0 3px rgba(0,212,255,.07); }
.fiq-ai-input::placeholder { color:var(--t3); }

.fiq-ingest-btn {
  background: linear-gradient(135deg, #00D4FF, #10D9A0); border:none; color:#030810;
  font-family:var(--display); font-weight:800; font-size:13px;
  letter-spacing:.08em; text-transform:uppercase;
  cursor:pointer; padding:15px 0; border-radius:8px;
  display:flex; align-items:center; justify-content:center; gap:8px;
  width:100%; transition:all .2s;
}
.fiq-ingest-btn:hover:not(:disabled) { box-shadow:0 0 28px rgba(0,212,255,.4),0 0 56px rgba(16,217,160,.15); transform:translateY(-2px); }
.fiq-ingest-btn:disabled { background:rgba(20,30,50,.8); color:#5A7A9A; cursor:not-allowed; }
@media (min-width: 640px) {
  .fiq-ingest-btn { width: auto; padding: 14px 32px; }
}

.fiq-job-card { animation:fiq-fadeUp .35s ease both; transition:transform .2s, box-shadow .2s; }
.fiq-job-card:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,.35); }
.fiq-job-running {
  background: linear-gradient(90deg, transparent 0%, rgba(255,173,51,.05) 50%, transparent 100%) !important;
  background-size: 200% 100% !important;
  animation: fiq-fadeUp .35s ease both, fiq-shimmer 3s linear infinite !important;
}

.fiq-main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 20px;
}
@media (min-width: 900px) {
  .fiq-main-grid { grid-template-columns: 1fr 1fr; }
}

.fiq-orb-intent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
@media (min-width: 640px) {
  .fiq-orb-intent {
    flex-direction: row;
    align-items: flex-start;
    gap: 24px;
  }
}

.fiq-job-grid {
  display: grid;
  grid-template-columns: 10px minmax(0,1fr) 96px 72px;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
@media (min-width: 1024px) {
  .fiq-job-grid {
    grid-template-columns: 10px minmax(180px,1.6fr) minmax(120px,.9fr) 120px 130px 80px 128px 100px;
    gap: 16px;
    padding: 15px 20px;
  }
}
.fiq-job-supplier,
.fiq-job-schema { display: none; }
.fiq-job-validation,
.fiq-job-dur { display: none; }
@media (min-width: 1024px) {
  .fiq-job-supplier,
  .fiq-job-schema { display: block; }
  .fiq-job-validation,
  .fiq-job-dur { display: block; }
}

.fiq-source-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 8px;
  transition: background .15s;
}
@media (min-width: 480px) { .fiq-source-item { padding: 12px 14px; gap: 14px; } }

.fiq-file-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 20px;
  background: rgba(0,212,255,.06); border: 1px solid rgba(0,212,255,.2);
  font-family: var(--mono); font-size: 11px; color: var(--c1);
  max-width: 220px;
}
.fiq-chip-remove {
  background: none; border: none; cursor: pointer; color: rgba(0,212,255,.5);
  padding: 0 0 0 2px; line-height: 1; transition: color .15s;
  font-size: 14px; display: flex; align-items: center;
}
.fiq-chip-remove:hover { color: var(--c1); }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FileIqWorkspaceShell() {
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [urlText, setUrlText]           = useState("");
  const [intent, setIntent]             = useState("");
  const [isDragging, setIsDragging]     = useState(false);
  const [isIngesting, setIsIngesting]   = useState(false);
  const [ingestError, setIngestError]   = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [jobs, setJobs]                 = useState<JobRow[]>([]);
  const [jobsLoading, setJobsLoading]   = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/fileiq/jobs?limit=20");
      if (res.ok) {
        const data = (await res.json()) as { jobs?: JobRow[] };
        setJobs(data.jobs ?? []);
      }
    } catch {
      // non-fatal — table may not be migrated yet
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats = {
    total:     jobs.length,
    completed: jobs.filter((j) => j.status === "completed").length,
    running:   jobs.filter((j) => j.status === "running").length,
    products:  jobs.reduce((s, j) => s + extractedCount(j), 0),
  };
  const schemaVer = latestSchemaVersion(jobs);

  // ── URL parsing ───────────────────────────────────────────────────────────

  const parsedUrls = urlText.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── File handling ─────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setDroppedFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...arr.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  }, []);

  const removeFile = (i: number) => setDroppedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop      = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };
  const handleBrowseClick    = () => fileInputRef.current?.click();
  const handleDropZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleBrowseClick(); }
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; }
  };

  // ── Ingest ────────────────────────────────────────────────────────────────

  const totalQueued = droppedFiles.length + parsedUrls.length;
  const canIngest   = totalQueued > 0 && !isIngesting;

  const handleIngest = async () => {
    if (!canIngest) return;
    setIsIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);
    try {
      const fd = new FormData();
      for (const file of droppedFiles) fd.append("file", file, file.name);
      if (parsedUrls.length > 0) fd.append("urls", JSON.stringify(parsedUrls));
      fd.append("intent", intent);
      const res  = await fetch("/api/fileiq/ingest", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setIngestError(data.message ?? "Ingestion failed.");
      } else {
        setDroppedFiles([]); setUrlText(""); setIntent("");
        setIngestSuccess("Extraction queued — check the stream below for results.");
        await loadJobs();
      }
    } catch {
      setIngestError("Network error. Please try again.");
    } finally {
      setIsIngesting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{FILEIQ_CSS}</style>

      <div className="fileiq-root" data-testid="fileiq-workspace-shell">

        {/* ── AURORA ── */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", width: "min(700px,120vw)", height: "min(700px,120vw)",
            borderRadius: "50%", background: "radial-gradient(circle,rgba(0,212,255,.10) 0%,transparent 70%)",
            top: "-20%", left: "-15%", animation: "fiq-aurora1 13s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "min(500px,100vw)", height: "min(500px,100vw)",
            borderRadius: "50%", background: "radial-gradient(circle,rgba(123,94,167,.09) 0%,transparent 70%)",
            top: "20%", right: "-10%", animation: "fiq-aurora2 17s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "min(400px,90vw)", height: "min(400px,90vw)",
            borderRadius: "50%", background: "radial-gradient(circle,rgba(16,217,160,.07) 0%,transparent 70%)",
            bottom: "-10%", left: "25%", animation: "fiq-aurora3 11s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(0,212,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.018) 1px,transparent 1px)",
            backgroundSize: "48px 48px" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── HEADER ── */}
          <header style={{ borderBottom: "1px solid rgba(80,140,200,.07)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            position: "sticky", top: 0, zIndex: 50 }}>

            {/* Top row */}
            <div style={{ height: 52, padding: "0 16px",
              display: "grid", gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center" }}>

              {/* Back to iBrains */}
              <a href="https://app.ibrains.ai"
                style={{ display: "inline-flex", alignItems: "center", gap: 7,
                  textDecoration: "none", cursor: "pointer", transition: "opacity .2s",
                  justifySelf: "start" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = ".6")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--t2)" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 13,
                  letterSpacing: ".03em",
                  background: "linear-gradient(90deg,#00D4FF,#10D9A0)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  iBrains
                </span>
              </a>

              {/* Center: FileIQ */}
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 18,
                  letterSpacing: ".05em", color: "var(--t1)" }}>
                  File<span style={{ background: "linear-gradient(90deg,#00D4FF,#10D9A0)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>IQ</span>
                </span>
              </div>

              {/* Schema badge */}
              <div style={{ justifySelf: "end" }}>
                <div style={{ padding: "4px 10px", borderRadius: 20,
                  border: "1px solid rgba(16,217,160,.25)", background: "rgba(16,217,160,.06)",
                  display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10D9A0",
                    boxShadow: "0 0 8px #10D9A0", animation: "fiq-blink 2.5s ease-in-out infinite" }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#10D9A0" }}>
                    {schemaVer}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
              gap: 24, padding: "7px 16px 10px",
              borderTop: "1px solid rgba(80,140,200,.06)", flexWrap: "wrap" }}>
              {([ ["JOBS", stats.total, false], ["COMPLETED", stats.completed, false],
                  ["RUNNING", stats.running, true], ["PRODUCTS", stats.products, false],
                ] as const).map(([l, v, warn]) => (
                <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 400,
                    color: warn && v > 0 ? "var(--amber)" : "var(--t1)" }}>{v}</span>
                  <span style={{ fontFamily: "var(--display)", fontSize: 8, fontWeight: 700,
                    letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(80,115,160,0.65)" }}>{l}</span>
                </div>
              ))}
            </div>
          </header>

          {/* ── MAIN ── */}
          <div style={{ padding: "20px 16px", maxWidth: 1380, margin: "0 auto" }}>

            {/* Top grid */}
            <div className="fiq-main-grid">

              {/* Ingest panel */}
              <div className="fiq-glass fiq-grad-border" style={{ borderRadius: 14, padding: "24px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                  <span className="fiq-sl">Ingest Source</span>
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(0,212,255,.25),transparent)" }} />
                </div>

                <div className="fiq-orb-intent">

                  {/* Upload orb */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Drop files here or click to browse"
                      data-testid="fileiq-drop-zone"
                      className={`fiq-upload-orb${isDragging ? " drag" : ""}`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={handleBrowseClick}
                      onKeyDown={handleDropZoneKeyDown}
                    >
                      <div className="fiq-orb-r2" />
                      <div className="fiq-orb-r1" />
                      <div className="fiq-orb-core" />
                      {isDragging && <div className="fiq-orb-pulse" />}
                      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 18px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                          stroke={isDragging ? "#00D4FF" : "rgba(0,212,255,.45)"}
                          strokeWidth="1.5" strokeLinecap="round"
                          style={{ display: "block", margin: "0 auto 8px", transition: "stroke .2s" }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 10,
                          letterSpacing: ".09em", textTransform: "uppercase",
                          color: isDragging ? "#00D4FF" : "var(--t2)", transition: "color .2s" }}>
                          {isDragging ? "Release" : "Drop files"}
                        </div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--t3)", marginTop: 3 }}>
                          or tap to browse
                        </div>
                      </div>
                    </div>

                    {/* File type badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 12,
                      justifyContent: "center", maxWidth: 200 }}>
                      {["PDF", "XLSX", "CSV", "DOCX", "HTML", "PNG"].map((t) => (
                        <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 8,
                          color: "var(--t3)", letterSpacing: ".05em",
                          padding: "2px 5px", border: "1px solid rgba(80,140,200,.14)",
                          borderRadius: 3 }}>{t}</span>
                      ))}
                    </div>

                    {/* Queued file chips */}
                    {droppedFiles.length > 0 && (
                      <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5, width: "100%", maxWidth: 220 }}
                        data-testid="fileiq-queued-files"
                        aria-label={`${droppedFiles.length} file${droppedFiles.length !== 1 ? "s" : ""} queued`}>
                        {droppedFiles.map((file, i) => (
                          <li key={`${file.name}:${file.size}:${i}`} className="fiq-file-chip">
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                              {file.name}
                            </span>
                            <button type="button" className="fiq-chip-remove"
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              aria-label={`Remove ${file.name}`}>×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Right: intent + URLs + button */}
                  <div style={{ flex: 1, width: "100%" }}>

                    {/* Intent */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: "var(--display)", fontSize: 9, fontWeight: 700,
                        letterSpacing: ".13em", textTransform: "uppercase",
                        color: "var(--t3)", marginBottom: 6 }}>Extraction Intent</div>
                      <textarea
                        id="fileiq-intent-input"
                        className="fiq-ai-input"
                        value={intent}
                        onChange={(e) => setIntent(e.target.value)}
                        placeholder="Describe what to extract — e.g. all SKUs with pricing and inventory for EcomViper"
                        rows={4}
                        data-testid="fileiq-intent-input"
                        style={{ padding: "12px 14px", resize: "none", lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Source URLs */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center",
                        justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontFamily: "var(--display)", fontSize: 9, fontWeight: 700,
                          letterSpacing: ".13em", textTransform: "uppercase",
                          color: "rgba(90,130,175,0.8)" }}>Source URLs</div>
                        {parsedUrls.length > 0 && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 9,
                            color: "var(--c1)", letterSpacing: ".04em" }}
                            data-testid="fileiq-url-count">
                            {parsedUrls.length} URL{parsedUrls.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <textarea
                        id="fileiq-url-input"
                        className="fiq-ai-input"
                        value={urlText}
                        onChange={(e) => setUrlText(e.target.value)}
                        placeholder={"https://supplier.com/catalog.pdf\nhttps://supplier.com/inventory.xlsx\nhttps://supplier.com/msrp.pdf"}
                        rows={3}
                        data-testid="fileiq-url-input"
                        aria-label="URLs to ingest, one per line"
                        style={{ padding: "12px 14px", resize: "none", lineHeight: 1.6,
                          fontFamily: "var(--mono)", fontSize: 11 }}
                      />
                      <div style={{ fontFamily: "var(--body)", fontSize: 11, color: "var(--t2)",
                        marginTop: 6, letterSpacing: ".01em" }}>
                        One URL per line — all jobs run in parallel
                      </div>
                    </div>

                    {/* Error / success */}
                    {ingestError && (
                      <p role="alert" data-testid="fileiq-ingest-error"
                        style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginBottom: 10 }}>
                        {ingestError}
                      </p>
                    )}
                    {ingestSuccess && (
                      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#10D9A0", marginBottom: 10 }}>
                        {ingestSuccess}
                      </p>
                    )}

                    {/* Ingest button */}
                    <button
                      type="button"
                      className="fiq-ingest-btn"
                      disabled={!canIngest}
                      aria-disabled={!canIngest}
                      onClick={() => void handleIngest()}
                      data-testid="fileiq-ingest-button"
                    >
                      {isIngesting ? "Queuing…" : totalQueued > 0 ? `Begin Extraction (${totalQueued})` : "Begin Extraction"}
                      {!isIngesting && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>

                    {/* Hidden file input */}
                    <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
                      tabIndex={-1} aria-hidden="true" onChange={handleFileInput} />
                  </div>
                </div>
              </div>

              {/* Source Intelligence Map */}
              <div className="fiq-glass fiq-grad-border" style={{ borderRadius: 14, padding: "24px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span className="fiq-sl">Source Intelligence Map</span>
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(0,212,255,.25),transparent)" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {SOURCES.map((s, i) => (
                    <div key={i} className="fiq-source-item"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      style={{ animation: `fiq-fadeUp .3s ease ${i * 50}ms both` }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: `${s.color}12`, border: `1px solid ${s.color}38`,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%",
                          background: s.color, boxShadow: `0 0 7px ${s.color}` }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--display)", fontSize: 13, fontWeight: 600,
                          color: "var(--t1)", marginBottom: 1 }}>{s.name}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--t3)",
                          letterSpacing: ".02em" }}>{s.truth}</div>
                      </div>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 8, color: s.color,
                        border: `1px solid ${s.color}35`, padding: "2px 7px",
                        borderRadius: 3, letterSpacing: ".06em", flexShrink: 0 }}>ACTIVE</span>
                    </div>
                  ))}
                </div>

                {/* Schema lock */}
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10,
                  background: "rgba(16,217,160,.05)", border: "1px solid rgba(16,217,160,.15)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10D9A0",
                      boxShadow: "0 0 10px #10D9A0", flexShrink: 0,
                      animation: "fiq-blink 3s ease-in-out infinite" }} />
                    <div>
                      <div style={{ fontFamily: "var(--display)", fontSize: 12, fontWeight: 600,
                        color: "var(--t1)" }}>product_catalog</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--t3)" }}>
                        schema contract — all brains
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500,
                    letterSpacing: ".05em", flexShrink: 0,
                    background: "linear-gradient(90deg,#00D4FF,#10D9A0)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {schemaVer} LOCKED
                  </div>
                </div>
              </div>
            </div>

            {/* ── EXTRACTION STREAM ── */}
            <div data-testid="fileiq-recent-jobs">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span className="fiq-sl">Extraction Stream</span>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(0,212,255,.2),transparent)" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)" }}>
                  {stats.total} job{stats.total !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Column headers */}
              <div className="fiq-job-grid" style={{ paddingTop: 8, paddingBottom: 8, marginBottom: 4,
                borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                {[
                  ["", ""],
                  ["Source", ""],
                  ["Supplier", "fiq-job-supplier"],
                  ["Status", ""],
                  ["Schema", "fiq-job-schema"],
                  ["Extracted", ""],
                  ["Validation", "fiq-job-validation"],
                  ["Submitted", "fiq-job-dur"],
                ].map(([h, cls]) => (
                  <span key={h || "dot"} className={cls}
                    style={{ fontFamily: "var(--display)", fontSize: 8, fontWeight: 700,
                      letterSpacing: ".12em", textTransform: "uppercase", color: "var(--t3)",
                      textAlign: h === "Extracted" ? "center" : h === "Submitted" ? "right" : "left" }}>
                    {h}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {jobsLoading ? (
                  <div style={{ padding: "40px 20px", textAlign: "center",
                    fontFamily: "var(--mono)", fontSize: 12, color: "var(--t3)" }}>
                    Loading…
                  </div>
                ) : jobs.length === 0 ? (
                  <div style={{ padding: "48px 20px", textAlign: "center",
                    fontFamily: "var(--mono)", fontSize: 12, color: "var(--t3)" }}
                    data-testid="fileiq-jobs-empty">
                    No extraction jobs yet — drop files or paste URLs above to get started.
                  </div>
                ) : (
                  jobs.map((job, idx) => {
                    const s         = STATUS[job.status] ?? STATUS.pending;
                    const isRunning = job.status === "running";
                    const count     = extractedCount(job);
                    const schema    = schemaLabel(job);
                    const supplier  = supplierName(job);
                    const validation = validationLabel(job);
                    const dur       = jobDuration(job);

                    return (
                      <div key={job.id} data-testid="fileiq-job-row"
                        className={`fiq-job-card fiq-glass fiq-grad-border${isRunning ? " fiq-job-running" : ""}`}
                        style={{ borderRadius: 10, animationDelay: `${idx * 60}ms` }}>
                        <div className="fiq-job-grid">

                          {/* Status dot */}
                          <div style={{ width: 8, height: 8, borderRadius: "50%",
                            background: s.color, boxShadow: `0 0 7px ${s.color}`,
                            animation: isRunning ? "fiq-blink 1s ease-in-out infinite" : "none",
                            flexShrink: 0 }} />

                          {/* Bundle name */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--t1)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              marginBottom: 1 }}>{job.bundleName}</div>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--t3)" }}>
                              {job.id.slice(0, 8)}
                            </div>
                          </div>

                          {/* Supplier — desktop */}
                          <div className="fiq-job-supplier" style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "var(--body)", fontSize: 12, color: "var(--t2)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {supplier}
                            </div>
                          </div>

                          {/* Status pill */}
                          <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 20,
                              background: s.bg, border: `1px solid ${s.border}`,
                              fontFamily: "var(--mono)", fontSize: 9, color: s.color,
                              whiteSpace: "nowrap", letterSpacing: ".04em" }}>
                              {s.label}
                            </div>
                          </div>

                          {/* Schema — desktop */}
                          <div className="fiq-job-schema"
                            style={{ fontFamily: "var(--mono)", fontSize: 10,
                              color: schema !== "—" ? "var(--t2)" : "var(--t3)", whiteSpace: "nowrap",
                              overflow: "hidden", textOverflow: "ellipsis" }}>
                            {schema}
                          </div>

                          {/* Extracted count */}
                          <div style={{ textAlign: "center" }}>
                            {count > 0 ? (
                              <div>
                                <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 400,
                                  lineHeight: 1,
                                  background: "linear-gradient(90deg,#00D4FF,#10D9A0)",
                                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                  {count}
                                </div>
                                <div style={{ fontFamily: "var(--mono)", fontSize: 7, color: "var(--t3)",
                                  letterSpacing: ".08em" }}>PRODUCTS</div>
                              </div>
                            ) : (
                              <span style={{ fontFamily: "var(--mono)", fontSize: 16, color: "var(--t3)" }}>—</span>
                            )}
                          </div>

                          {/* Validation — desktop */}
                          <div className="fiq-job-validation"
                            style={{ fontFamily: "var(--mono)", fontSize: 10,
                              color: validation !== "—" ? "var(--t2)" : "var(--t3)", whiteSpace: "nowrap" }}>
                            {validation}
                          </div>

                          {/* Duration + time — desktop */}
                          <div className="fiq-job-dur" style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t2)" }}>{dur}</div>
                            <div style={{ fontFamily: "var(--body)", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                              {relativeTime(job.createdAt)}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
