import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";

export const dynamic = "force-dynamic";

export default function AdminSetupShopifyPage() {
  return (
    <>
      <TopBar breadcrumbs={["Home", "EcomViper", "Help", "Admin Setup Shopify"]} />

      <HudCard
        title="App Owner Setup: Shopify OAuth"
        subtitle="Owner-only runtime configuration. End users should never manage server secrets."
      >
        <div className="space-y-5 text-sm text-slate-200">
          <section>
            <h3 className="text-base font-semibold text-cyan-200">1) Shopify app settings</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>App URL: <span className="font-mono">https://app.ibrains.ai</span></li>
              <li>Allowed redirect URL: <span className="font-mono">https://app.ibrains.ai/api/auth/shopify/callback</span></li>
              <li>Scopes: <span className="font-mono">read_products,read_content</span></li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">2) Required server env vars</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li><span className="font-mono">SHOPIFY_CLIENT_ID</span></li>
              <li><span className="font-mono">SHOPIFY_CLIENT_SECRET</span></li>
              <li><span className="font-mono">SHOPIFY_REDIRECT_URI=https://app.ibrains.ai/api/auth/shopify/callback</span></li>
              <li><span className="font-mono">APP_BASE_URL=https://app.ibrains.ai</span></li>
              <li><span className="font-mono">DATABASE_URL</span></li>
              <li><span className="font-mono">SERVER_ENCRYPTION_KEY</span></li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">3) systemd runtime steps</h3>
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300">
{`sudo mkdir -p /etc/ibrains
sudo nano /etc/ibrains/ibrains-app.env
sudo systemctl daemon-reload
sudo systemctl restart ibrains-next
sudo systemctl status ibrains-next --no-pager -l`}
            </pre>
          </section>

          <section>
            <h3 className="text-base font-semibold text-cyan-200">4) Security notes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>Never expose client secret in frontend code or logs.</li>
              <li>Keep env files readable only by root.</li>
              <li>Users connect stores from UI only; they never configure droplet env.</li>
            </ul>
          </section>
        </div>
      </HudCard>
    </>
  );
}
