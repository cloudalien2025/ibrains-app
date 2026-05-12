"use client";

export type ConnectionInstructionsProvider = "walmart" | "shopify" | "openai" | "serpapi";

type InstructionsContent = {
  title: string;
  subtitle: string;
  whatYouNeed: string[];
  requiredAccess?: string[];
  steps: string[];
  commonIssues: string[];
};

const CONNECTION_INSTRUCTIONS: Record<ConnectionInstructionsProvider, InstructionsContent> = {
  walmart: {
    title: "Walmart Marketplace Instructions",
    subtitle:
      "Use your Walmart Marketplace API credentials (BYO credentials). This flow does not install an OAuth public app.",
    whatYouNeed: [
      "Walmart Seller Center or Walmart Developer Portal access.",
      "Production Walmart Client ID and Client Secret.",
      "Marketplace region (US for US Marketplace).",
    ],
    requiredAccess: [
      "Items / Catalog read for product import.",
      "Inventory update for inventory sync workflows.",
      "Pricing update for pricing sync workflows.",
      "Feeds submit/read plus feed error reports for feed workflows.",
      "Item maintenance / content update for listing content updates.",
    ],
    steps: [
      "Sign in to Walmart Seller Center or the Walmart Developer Portal.",
      "Open API integration or API key management for your account/app.",
      "Copy your Client ID and Client Secret.",
      "In EcomViper Walmart Connect, enter account nickname, Client ID, Client Secret, and region.",
      "Click Save Credentials.",
      "Click Test Connection to verify token + safe read.",
      "Confirm the status panel updates with masked Client ID, secret stored state, token status, and timestamps.",
    ],
    commonIssues: [
      "Credentials are inactive, rotated, or copied incorrectly.",
      "Environment mismatch between Production credentials and the selected environment.",
      "Missing solution-provider permissions for catalog/items read.",
      "Credentials were rotated but not re-saved in EcomViper.",
      "Walmart API auth/service outage or throttling.",
      "Use Last API error in the status panel for exact failure reason.",
    ],
  },
  shopify: {
    title: "Shopify Source Catalog Instructions",
    subtitle:
      "Use a Shopify custom/admin app token and your myshopify store domain. OAuth public app install is not required.",
    whatYouNeed: [
      "Shopify store domain in the form `your-store.myshopify.com`.",
      "Shopify Admin API access token from a custom/admin app.",
      "Token scope: `read_products` for current feature set.",
    ],
    steps: [
      "In Shopify Admin, create or open a custom/admin app for your store.",
      "Grant at least `read_products` scope, then install/update the app.",
      "Copy the Admin API access token.",
      "In EcomViper Shopify Source Catalog, paste store domain and Admin API token.",
      "Click Test Connection.",
      "Click Save Shopify.",
      "Click Import/Sync Shopify products to populate catalog + image metadata.",
    ],
    commonIssues: [
      "Store domain is not the `myshopify.com` domain.",
      "Token has been revoked, rotated, or copied with extra whitespace.",
      "App token is missing `read_products` scope.",
      "Custom/admin app exists but is not installed on the store.",
    ],
  },
  openai: {
    title: "OpenAI API Instructions",
    subtitle:
      "Use an OpenAI API key from your API project. A ChatGPT sign-in alone does not provide an API key.",
    whatYouNeed: [
      "Access to OpenAI API project settings.",
      "An API key with permissions for your intended usage.",
      "Billing/project access for API requests.",
    ],
    steps: [
      "Open the OpenAI API platform and choose your project.",
      "Create a new API key.",
      "Copy the key once and store it securely.",
      "In EcomViper OpenAI API, paste the key.",
      "Click Test API Key.",
      "Click Save OpenAI Key.",
    ],
    commonIssues: [
      "Using ChatGPT credentials instead of an API key.",
      "Project has no billing access or is disabled.",
      "Key was revoked or restricted too tightly.",
      "Whitespace/paste artifacts in the key field.",
    ],
  },
  serpapi: {
    title: "SerpAPI Instructions",
    subtitle:
      "SerpAPI is used as a public Walmart listing/image discovery fallback when Walmart APIs do not provide images.",
    whatYouNeed: [
      "SerpAPI account access.",
      "API key from your SerpAPI dashboard/account page.",
      "Available monthly search quota.",
    ],
    steps: [
      "Sign in to SerpAPI.",
      "Copy your API key from account/dashboard settings.",
      "In EcomViper SerpAPI, paste the key.",
      "Click Test API Key.",
      "Click Save SerpApi Key.",
    ],
    commonIssues: [
      "API key is invalid, rotated, or copied incorrectly.",
      "Monthly quota is exceeded or account is inactive.",
      "Provider is connected but source data has no matching result.",
      "Recent changes may require a fresh test after cache expiration.",
    ],
  },
};

interface ConnectionInstructionsDialogProps {
  provider: ConnectionInstructionsProvider | null;
  onClose: () => void;
}

export default function ConnectionInstructionsDialog({
  provider,
  onClose,
}: ConnectionInstructionsDialogProps) {
  if (!provider) return null;

  const content = CONNECTION_INSTRUCTIONS[provider];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#0F172A]/55 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${content.title} instructions`}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#D9E4F0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.24)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">{content.title}</h2>
            <p className="mt-1 text-sm text-[#475569]">{content.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-[#334155]">
          <section>
            <h3 className="font-semibold text-[#0F172A]">What you&apos;ll need</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {content.whatYouNeed.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {content.requiredAccess && content.requiredAccess.length > 0 ? (
            <section>
              <h3 className="font-semibold text-[#0F172A]">Required Access</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {content.requiredAccess.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="font-semibold text-[#0F172A]">Setup steps</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {content.steps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-[#0F172A]">Common issues</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {content.commonIssues.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
