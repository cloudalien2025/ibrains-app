"use client";

import { useMemo, useState } from "react";
import {
  BlogPost,
  Listing,
  VerticalConfig,
  buildDraft,
  computeScore,
  detectVertical,
  hasContextualListingLink,
  progressMessages,
  verticalConfigs,
} from "./directoryiq";

type Screen = "Dashboard" | "Listings" | "Versions" | "Settings";

type VersionRecord = {
  id: string;
  timestamp: string;
  listingId: string;
  scoreSnapshot: number;
  contentDelta: string;
  linkDelta: string;
};

type DiffPreview = {
  mode: "listing" | "blog";
  title: string;
  before: string;
  after: string;
  imagePreview?: string;
  insertedLinks: string[];
  scoreBefore: number;
  scoreAfter: number;
};

const starterListings: Listing[] = [
  {
    id: "l-100",
    name: "Harrison Family Law",
    verticalHint: "attorney",
    title: "Harrison Family Law",
    description: "Family law firm serving mediation and custody matters in Denver metro.",
    category: "Attorneys",
    location: "Denver, CO",
    contact: "(303) 555-1200",
    serviceArea: "Denver Metro",
    taxonomyAligned: true,
    locationIntegrity: true,
    sectionFormatting: 72,
    structuredFields: 70,
    specificity: 65,
    scopeDefinition: 68,
    differentiators: 55,
    machineReadableSignals: 60,
    genericLanguage: 35,
    ambiguitySeverity: "light",
    reviews: 62,
    credentials: 78,
    evidenceSignals: 60,
    identityConsistency: 85,
    riskInverse: 55,
    ctaVisibility: 70,
    bookingFunctionality: 64,
    conversionFrictionInverse: 65,
    commercialAlignment: 58,
    responsePathClarity: 67,
    relatedGuides: [{ title: "How to Compare Family Attorneys", url: "/blog/compare-family-attorneys" }],
    posts: [
      {
        id: "p-1",
        type: "comparison",
        title: "How to Compare Family Attorneys in Denver",
        focusTopic: "family attorney comparison",
        status: "Published",
        body: "Published reference post",
        blogToListingLinked: true,
        listingToBlogLinked: true,
      },
      {
        id: "p-2",
        type: "contextual-guide",
        title: "Custody Consultation Preparation Guide",
        focusTopic: "custody consultation checklist",
        status: "Not Created",
        body: "",
        blogToListingLinked: false,
        listingToBlogLinked: false,
      },
    ],
    lastOptimized: "2026-02-20 14:05",
  },
  {
    id: "l-200",
    name: "PeakFlow HVAC",
    verticalHint: "hvac",
    title: "PeakFlow HVAC",
    description: "",
    category: "Home Services",
    location: "Boulder, CO",
    contact: "",
    serviceArea: "Front Range",
    taxonomyAligned: true,
    locationIntegrity: true,
    sectionFormatting: 54,
    structuredFields: 45,
    specificity: 50,
    scopeDefinition: 42,
    differentiators: 38,
    machineReadableSignals: 45,
    genericLanguage: 60,
    ambiguitySeverity: "moderate",
    reviews: 55,
    credentials: 48,
    evidenceSignals: 50,
    identityConsistency: 60,
    riskInverse: 62,
    ctaVisibility: 42,
    bookingFunctionality: 30,
    conversionFrictionInverse: 35,
    commercialAlignment: 40,
    responsePathClarity: 34,
    relatedGuides: [],
    posts: [
      {
        id: "p-3",
        type: "best-of",
        title: "Best HVAC Maintenance Plans for Seasonal Prep",
        focusTopic: "best HVAC maintenance plan",
        status: "Not Created",
        body: "",
        blogToListingLinked: false,
        listingToBlogLinked: false,
      },
    ],
    lastOptimized: "Not optimized",
  },
];

const sidebarScreens: Screen[] = ["Dashboard", "Listings", "Versions", "Settings"];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [listings, setListings] = useState<Listing[]>(starterListings);
  const [selectedListingId, setSelectedListingId] = useState(starterListings[0].id);
  const [manualVertical, setManualVertical] = useState<string>("auto");
  const [progressIndex, setProgressIndex] = useState(0);
  const [diffPreview, setDiffPreview] = useState<DiffPreview | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);

  const selectedListing = listings.find((l) => l.id === selectedListingId) ?? listings[0];
  const activeVertical: VerticalConfig =
    manualVertical === "auto"
      ? detectVertical(selectedListing)
      : verticalConfigs.find((v) => v.key === manualVertical) ?? detectVertical(selectedListing);

  const listingScores = useMemo(
    () => listings.map((listing) => ({ listing, score: computeScore(listing, detectVertical(listing)) })),
    [listings]
  );

  const selectedScore = computeScore(selectedListing, activeVertical);
  const readiness = Math.round(
    listingScores.reduce((acc, item) => acc + item.score.total, 0) / Math.max(1, listingScores.length)
  );

  const aggregatePillars = useMemo(() => {
    const seed = { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 };
    listingScores.forEach(({ score }) => {
      seed.structure += score.pillars.structure;
      seed.clarity += score.pillars.clarity;
      seed.trust += score.pillars.trust;
      seed.authority += score.pillars.authority;
      seed.actionability += score.pillars.actionability;
    });
    return {
      structure: Math.round(seed.structure / listingScores.length),
      clarity: Math.round(seed.clarity / listingScores.length),
      trust: Math.round(seed.trust / listingScores.length),
      authority: Math.round(seed.authority / listingScores.length),
      actionability: Math.round(seed.actionability / listingScores.length),
    };
  }, [listingScores]);

  function refreshAnalysis() {
    setProgressIndex((prev) => (prev + 1) % progressMessages.length);
  }

  function updateListing(next: Listing) {
    setListings((prev) => prev.map((item) => (item.id === next.id ? next : item)));
  }

  function openListingDiff() {
    const before = selectedListing.description || "(empty)";
    const after =
      selectedListing.description +
      "\n\nRelated Guides:\n- Custody consultation framework\n- Documentation readiness checklist";
    const beforeScore = selectedScore.total;
    const afterListing = { ...selectedListing, description: `${selectedListing.description} Additional verified detail.` };
    const afterScore = computeScore(afterListing, activeVertical).total;
    setDiffPreview({
      mode: "listing",
      title: "Listing optimization blueprint update",
      before,
      after,
      insertedLinks: ["Listing → Blog links inserted in Related Guides section"],
      scoreBefore: beforeScore,
      scoreAfter: afterScore,
    });
  }

  function generateDraft(postId: string) {
    const post = selectedListing.posts.find((item) => item.id === postId);
    if (!post) return;
    const draft = buildDraft(post, selectedListing);
    if (!hasContextualListingLink(draft, selectedListing.id)) return;

    const next = {
      ...selectedListing,
      posts: selectedListing.posts.map((item) =>
        item.id === postId ? { ...item, body: draft, status: "Draft", blogToListingLinked: true } : item
      ),
    };
    updateListing(next);
  }

  function generateFeaturedImage(postId: string) {
    const next = {
      ...selectedListing,
      posts: selectedListing.posts.map((item) =>
        item.id === postId
          ? {
              ...item,
              featuredImagePrompt: `Editorial featured image for ${item.focusTopic}. Include subtle overlay text: ${item.focusTopic}.`,
              featuredImageUrl: `https://images.example.com/${item.id}.jpg`,
            }
          : item
      ),
    };
    updateListing(next);
  }

  function previewPost(post: BlogPost) {
    const beforeScore = selectedScore.total;
    const postReady = post.body || "(empty draft)";
    setDiffPreview({
      mode: "blog",
      title: `Preview: ${post.title}`,
      before: "No published draft",
      after: postReady,
      imagePreview: post.featuredImageUrl,
      insertedLinks: [
        `Blog → Listing link contextual anchor present for ${selectedListing.name}`,
        "Listing → Blog reciprocal link will be inserted in Related Guides",
      ],
      scoreBefore: beforeScore,
      scoreAfter: Math.min(100, beforeScore + 5),
    });
  }

  function approveAndPush() {
    if (!diffPreview) return;
    const version: VersionRecord = {
      id: `V-${versions.length + 1}`,
      timestamp: new Date().toISOString(),
      listingId: selectedListing.id,
      scoreSnapshot: diffPreview.scoreAfter,
      contentDelta: diffPreview.title,
      linkDelta: diffPreview.insertedLinks.join(" | "),
    };

    if (diffPreview.mode === "blog") {
      const next = {
        ...selectedListing,
        posts: selectedListing.posts.map((post) =>
          post.status === "Draft"
            ? { ...post, status: "Published", listingToBlogLinked: true, blogToListingLinked: true }
            : post
        ),
        relatedGuides: [...selectedListing.relatedGuides, { title: "Published guide", url: "/blog/published-guide" }],
        lastOptimized: new Date().toLocaleString(),
      };
      updateListing(next);
    }

    setVersions((prev) => [version, ...prev]);
    setDiffPreview(null);
  }

  function restoreVersion(record: VersionRecord) {
    setDiffPreview({
      mode: "listing",
      title: `Restore ${record.id}`,
      before: "Current listing state",
      after: `Restore content delta: ${record.contentDelta}`,
      insertedLinks: [record.linkDelta],
      scoreBefore: selectedScore.total,
      scoreAfter: record.scoreSnapshot,
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">DirectoryIQ</p>
          <h1 className="text-xl font-semibold">AI Agent Selection Optimization Engine</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-200">BD Site Connected</span>
          <label>
            Vertical:
            <select
              className="ml-2 rounded bg-slate-800 px-2 py-1"
              value={manualVertical}
              onChange={(e) => setManualVertical(e.target.value)}
            >
              <option value="auto">Auto ({detectVertical(selectedListing).label})</option>
              {verticalConfigs.map((vertical) => (
                <option key={vertical.key} value={vertical.key}>
                  {vertical.label}
                </option>
              ))}
            </select>
          </label>
          <span>Last analyzed: {new Date().toLocaleString()}</span>
          <button className="rounded bg-slate-800 px-3 py-1">User Menu</button>
        </div>
      </header>

      <div className="flex">
        <aside className="min-h-[calc(100vh-73px)] w-56 border-r border-white/10 p-4">
          {sidebarScreens.map((item) => (
            <button
              key={item}
              onClick={() => setScreen(item)}
              className={`mb-2 block w-full rounded px-3 py-2 text-left ${
                screen === item ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5"
              }`}
            >
              {item}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-6">
          {screen === "Dashboard" && (
            <section className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <p className="text-sm text-slate-300">AI Agent Selection Readiness</p>
                <p className="text-5xl font-bold text-cyan-300">{readiness}</p>
                <div className="mt-4 grid grid-cols-5 gap-3 text-xs">
                  {Object.entries(aggregatePillars).map(([k, v]) => (
                    <div key={k} className="rounded bg-black/20 p-2">
                      <p className="capitalize">{k}</p>
                      <p className="text-lg font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
                <button onClick={refreshAnalysis} className="mt-4 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold">
                  Refresh Analysis
                </button>
                <p className="mt-2 text-sm text-slate-300">{progressMessages[progressIndex]}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h2 className="mb-3 text-lg font-semibold">Listings</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-300">
                      <th>Listing</th>
                      <th>AI Agent Selection Score</th>
                      <th>Authority</th>
                      <th>Trust</th>
                      <th>Last optimized</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listingScores.map(({ listing, score }) => (
                      <tr key={listing.id} className="border-t border-white/10">
                        <td className="py-2">{listing.name}</td>
                        <td>{score.total}</td>
                        <td>{score.authorityStatus}</td>
                        <td>{score.trustStatus}</td>
                        <td>{listing.lastOptimized}</td>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedListingId(listing.id);
                              setScreen("Listings");
                            }}
                            className="rounded bg-slate-700 px-2 py-1"
                          >
                            Optimize
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {screen === "Listings" && (
            <section className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h2 className="text-2xl font-semibold">{selectedListing.name}</h2>
                <p className="text-5xl font-bold text-cyan-300">{selectedScore.total}</p>
                <div className="mt-3 grid grid-cols-5 gap-3 text-xs">
                  {Object.entries(selectedScore.pillars).map(([k, v]) => (
                    <div key={k} className="rounded bg-black/20 p-2">
                      <p className="capitalize">{k}</p>
                      <p className="text-lg font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  <li>{selectedScore.capIndicators.structuralGate}</li>
                  <li>{selectedScore.capIndicators.authorityCeiling}</li>
                  <li>{selectedScore.capIndicators.ambiguityPenalty}</li>
                  <li>{selectedScore.capIndicators.trustRiskCap}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h3 className="text-lg font-semibold">Detected Gaps</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Structure, clarity, trust, authority, and actionability opportunities are grouped for deterministic remediation.
                </p>
                <button onClick={openListingDiff} className="mt-3 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold">
                  Generate Optimization Blueprint
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h3 className="text-lg font-semibold">Authority Support (max 4 posts)</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {selectedListing.posts.slice(0, 4).map((post) => (
                    <article key={post.id} className="rounded border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-indigo-500/20 px-2 py-1 text-xs uppercase">{post.type}</span>
                        <span className="text-xs">{post.status}</span>
                      </div>
                      <h4 className="mt-2 font-semibold">{post.title}</h4>
                      <p className="text-xs text-slate-300">Focus topic: {post.focusTopic}</p>
                      <p className="mt-1 text-xs">
                        Blog→Listing: {post.blogToListingLinked ? "Linked" : "Missing"} | Listing→Blog:{" "}
                        {post.listingToBlogLinked ? "Linked" : "Missing"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <button onClick={() => generateDraft(post.id)} className="rounded bg-slate-700 px-2 py-1">
                          Generate Draft
                        </button>
                        <button onClick={() => generateFeaturedImage(post.id)} className="rounded bg-slate-700 px-2 py-1">
                          Generate Featured Image
                        </button>
                        <button onClick={() => previewPost(post)} className="rounded bg-slate-700 px-2 py-1">
                          Preview
                        </button>
                        <button
                          onClick={() => previewPost(post)}
                          className="rounded bg-emerald-700 px-2 py-1"
                          disabled={post.status !== "Draft" && post.status !== "Published"}
                        >
                          Publish
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {screen === "Versions" && (
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">Version History</h2>
              <div className="mt-4 space-y-3">
                {versions.length === 0 && <p className="text-sm text-slate-300">No versions yet.</p>}
                {versions.map((record) => (
                  <div key={record.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                    <p>
                      {record.id} · Score {record.scoreSnapshot} · {record.timestamp}
                    </p>
                    <p className="text-slate-300">{record.contentDelta}</p>
                    <button onClick={() => restoreVersion(record)} className="mt-2 rounded bg-slate-700 px-2 py-1 text-xs">
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {screen === "Settings" && (
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5 text-sm">
              <h2 className="text-xl font-semibold">Settings</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span>BD API credentials</span>
                  <input className="mt-1 w-full rounded bg-slate-800 px-2 py-2" placeholder="BD API key" />
                </label>
                <label className="block">
                  <span>OpenAI API key (BYO)</span>
                  <input className="mt-1 w-full rounded bg-slate-800 px-2 py-2" placeholder="sk-..." />
                </label>
                <label className="block">
                  <span>Risk tier classification</span>
                  <select className="mt-1 w-full rounded bg-slate-800 px-2 py-2">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label className="block">
                  <span>Image style preference</span>
                  <select className="mt-1 w-full rounded bg-slate-800 px-2 py-2">
                    <option>Editorial</option>
                    <option>Clean minimal</option>
                    <option>Magazine</option>
                  </select>
                </label>
              </div>
            </section>
          )}
        </main>
      </div>

      {diffPreview && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-slate-900 p-5">
            <h3 className="text-xl font-semibold">Diff Preview: {diffPreview.title}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-400">Before</p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-black/30 p-3 text-xs">{diffPreview.before}</pre>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">After</p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-black/30 p-3 text-xs">{diffPreview.after}</pre>
              </div>
            </div>
            {diffPreview.imagePreview && (
              <p className="mt-2 text-sm text-slate-300">Featured image preview: {diffPreview.imagePreview}</p>
            )}
            <div className="mt-3 rounded bg-black/30 p-3 text-sm">
              <p>Inserted Links</p>
              <ul className="list-disc pl-5">
                {diffPreview.insertedLinks.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-sm">
              Score delta preview: {diffPreview.scoreBefore} → {diffPreview.scoreAfter}
            </p>
            <div className="mt-4 flex gap-2 text-sm">
              <button onClick={approveAndPush} className="rounded bg-emerald-600 px-3 py-2 font-semibold">
                {diffPreview.mode === "listing" ? "Approve & Push" : "Approve & Publish"}
              </button>
              <button onClick={() => setDiffPreview(null)} className="rounded bg-slate-700 px-3 py-2">
                Edit
              </button>
              <button onClick={() => setDiffPreview(null)} className="rounded bg-slate-700 px-3 py-2">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
