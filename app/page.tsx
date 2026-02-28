"use client";

import { FormEvent, useMemo, useState } from "react";

type ConnectorStatus = "connected" | "disconnected" | "locked";

type CredentialField = {
  id: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
};

type Connector = {
  id: string;
  name: string;
  description: string;
  status: ConnectorStatus;
  fields: CredentialField[];
};

type BrainUI = {
  id: string;
  label: string;
  connectors: Connector[];
};

const brainUIs: BrainUI[] = [
  {
    id: "directoryiq",
    label: "DirectoryIQ",
    connectors: [
      {
        id: "brilliant-directories",
        name: "Brilliant Directories API",
        description: "Listings and blog signal ingest surface for travel entity readiness.",
        status: "connected",
        fields: [
          { id: "apiUrl", label: "API URL", placeholder: "https://your-domain.com/api" },
          { id: "apiKey", label: "API Key", type: "password", placeholder: "••••••••" },
        ],
      },
      {
        id: "openai",
        name: "OpenAI API (BYO)",
        description: "Entity normalization and signal synthesis.",
        status: "disconnected",
        fields: [
          { id: "apiKey", label: "OpenAI API Key", type: "password", placeholder: "sk-..." },
        ],
      },
      {
        id: "serpapi",
        name: "SerpAPI",
        description: "Competitive set discovery and comparative clarity checks.",
        status: "disconnected",
        fields: [
          { id: "apiKey", label: "SerpAPI Key", type: "password", placeholder: "••••••••" },
          { id: "engine", label: "Engine", placeholder: "google" },
        ],
      },
    ],
  },
  {
    id: "creatoriq",
    label: "CreatorIQ",
    connectors: [
      {
        id: "youtube",
        name: "YouTube Data API",
        description: "Trend and creator channel velocity signals.",
        status: "disconnected",
        fields: [
          { id: "apiKey", label: "API Key", type: "password", placeholder: "AIza..." },
        ],
      },
      {
        id: "instagram",
        name: "Instagram Graph API",
        description: "Audience growth and engagement cadence signals.",
        status: "disconnected",
        fields: [
          { id: "appId", label: "App ID", placeholder: "App ID" },
          { id: "appSecret", label: "App Secret", type: "password", placeholder: "••••••••" },
          { id: "accessToken", label: "Access Token", type: "password", placeholder: "••••••••" },
        ],
      },
      {
        id: "tiktok",
        name: "TikTok API",
        description: "Content momentum and hashtag lift indicators.",
        status: "locked",
        fields: [],
      },
    ],
  },
  {
    id: "authorityiq",
    label: "AuthorityIQ",
    connectors: [
      {
        id: "ga4",
        name: "GA4",
        description: "Behavior and conversion loopback signals.",
        status: "disconnected",
        fields: [
          { id: "propertyId", label: "Property ID", placeholder: "123456789" },
          { id: "serviceAccount", label: "Service Account JSON", placeholder: "{...}" },
        ],
      },
      {
        id: "gsc",
        name: "Google Search Console",
        description: "Query and impression authority indicators.",
        status: "disconnected",
        fields: [
          { id: "siteUrl", label: "Site URL", placeholder: "sc-domain:example.com" },
          { id: "oauthToken", label: "OAuth Token", type: "password", placeholder: "••••••••" },
        ],
      },
      {
        id: "ahrefs",
        name: "Ahrefs",
        description: "Backlink authority and competitor overlap signals.",
        status: "disconnected",
        fields: [{ id: "apiKey", label: "Ahrefs API Key", type: "password", placeholder: "••••••••" }],
      },
    ],
  },
];

export default function Home() {
  const [selectedUI, setSelectedUI] = useState(brainUIs[0].id);
  const [drawerState, setDrawerState] = useState<{ uiId: string; connectorId: string } | null>(null);
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});

  const activeUI = useMemo(
    () => brainUIs.find((ui) => ui.id === selectedUI) ?? brainUIs[0],
    [selectedUI]
  );

  const activeConnector = useMemo(() => {
    if (!drawerState) return null;
    return brainUIs
      .find((ui) => ui.id === drawerState.uiId)
      ?.connectors.find((connector) => connector.id === drawerState.connectorId);
  }, [drawerState]);

  const drawerKey = drawerState ? `${drawerState.uiId}:${drawerState.connectorId}` : "";
  const drawerCredentials = drawerKey ? credentials[drawerKey] ?? {} : {};

  function openDrawer(uiId: string, connectorId: string) {
    setDrawerState({ uiId, connectorId });
  }

  function closeDrawer() {
    setDrawerState(null);
  }

  function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    closeDrawer();
  }

  function updateField(fieldId: string, value: string) {
    if (!drawerKey) return;
    setCredentials((prev) => ({
      ...prev,
      [drawerKey]: {
        ...(prev[drawerKey] ?? {}),
        [fieldId]: value,
      },
    }));
  }

  function isConfigured(uiId: string, connectorId: string) {
    const key = `${uiId}:${connectorId}`;
    const saved = credentials[key] ?? {};
    return Object.values(saved).some((value) => value.trim().length > 0);
  }

  return (
    <div className="min-h-screen bg-[#070a12] px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-500/20 bg-[#03122f] p-8 shadow-2xl shadow-black/30">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Signal Sources</p>
        <h1 className="mt-2 text-3xl font-semibold">{activeUI.label} Signal Sources</h1>
        <p className="mt-2 text-zinc-300">
          Configure connectors in the drawer. The redundant inline Connector Credentials section has been removed.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {brainUIs.map((ui) => (
            <button
              key={ui.id}
              onClick={() => setSelectedUI(ui.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset ${
                ui.id === activeUI.id
                  ? "bg-cyan-400/20 text-cyan-100 ring-cyan-300/40"
                  : "bg-white/5 text-zinc-300 ring-white/10"
              }`}
            >
              {ui.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {activeUI.connectors.map((connector) => {
            const configured = isConfigured(activeUI.id, connector.id);
            const locked = connector.status === "locked";
            return (
              <div
                key={connector.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-semibold">{connector.name}</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-zinc-200">
                      {configured ? "configured" : connector.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">{connector.description}</p>
                </div>
                <button
                  disabled={locked}
                  onClick={() => openDrawer(activeUI.id, connector.id)}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-inset ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {configured ? "Configured" : "Configure"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {drawerState && activeConnector && (
        <>
          <button className="fixed inset-0 bg-black/50" onClick={closeDrawer} aria-label="Close drawer overlay" />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[#020b1f] p-6 text-zinc-100 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Connector Credentials</p>
                <h2 className="mt-2 text-2xl font-semibold">{activeConnector.name}</h2>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={saveCredentials}>
              {activeConnector.fields.length === 0 && (
                <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/20">
                  This connector is locked in the current release.
                </p>
              )}

              {activeConnector.fields.map((field) => (
                <label key={field.id} className="block">
                  <span className="mb-2 block text-sm text-zinc-200">{field.label}</span>
                  <input
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={drawerCredentials[field.id] ?? ""}
                    onChange={(event) => updateField(field.id, event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none ring-cyan-400/40 placeholder:text-zinc-500 focus:ring"
                  />
                </label>
              ))}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#001029]"
                >
                  Save
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
