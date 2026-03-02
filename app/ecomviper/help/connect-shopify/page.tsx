import Link from "next/link";
import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";

export const dynamic = "force-dynamic";

export default function ConnectShopifyHelpPage() {
  return (
    <>
      <TopBar breadcrumbs={["Home", "EcomViper", "Help", "Connect Shopify"]} />

      <HudCard title="How to connect your Shopify store" subtitle="User guide for OAuth connection and full-site ingestion.">
        <div className="space-y-5 text-sm text-slate-200">
          <section>
            <h3 className="text-base font-semibold text-cyan-200">1) What you need</h3>
            <p className="mt-2 text-slate-300">Shopify admin access to the store you want to connect.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">2) How to connect</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-300">
              <li>Go to EcomViper Settings and open Integrations.</li>
              <li>Enter your store domain in <span className="font-mono">yourstore.myshopify.com</span> format.</li>
              <li>Click Connect Shopify.</li>
              <li>Approve the requested permissions in Shopify.</li>
              <li>After callback, confirm you see Connected status.</li>
            </ol>
            <p className="mt-2">
              Open integrations page: <Link href="/ecomviper/settings/integrations" className="text-cyan-200 underline">/ecomviper/settings/integrations</Link>
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">3) How to ingest</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-300">
              <li>Click Ingest All Pages for your connected store.</li>
              <li>Wait for run completion; counts for products, articles, pages, and collections will appear.</li>
              <li>Visit a product Reasoning Hub page to view related post reasoning nodes.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">4) Troubleshooting</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>Invalid shop domain: use a valid domain like <span className="font-mono">*.myshopify.com</span> or your storefront domain.</li>
              <li>Couldn&apos;t verify request: retry connection if state/HMAC check fails.</li>
              <li>Permissions missing: reinstall via Connect Shopify to refresh scopes.</li>
              <li>Large store: ingest can take longer; rerun once complete to refresh newly published content.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">Admin setup (for store owners)</h3>
            <p className="mt-2 text-slate-300">
              If the app is not installed yet, EcomViper will send you to Shopify&apos;s install/permissions screen during OAuth. Approve requested read scopes to finish setup.
            </p>
            <p className="mt-2 text-slate-300">
              Owner-only environment setup:
              {" "}
              <Link href="/ecomviper/help/admin-setup-shopify" className="text-cyan-200 underline">
                /ecomviper/help/admin-setup-shopify
              </Link>
            </p>
          </section>
        </div>
      </HudCard>
    </>
  );
}
