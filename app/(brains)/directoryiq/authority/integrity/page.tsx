import { headers } from "next/headers";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";
import IntegrityClient from "./integrity-client";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import {
  computeTenantSummary,
  listAuthorityLeaks,
  listListingBacklinkCandidates,
} from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";

export const dynamic = "force-dynamic";

export default async function DirectoryIqAuthorityIntegrityPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const tenantId = "default";
  const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });

  if (!gate.enabled) {
    return (
      <div className="space-y-4">
        <AuthoritySectionNav />
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Integrity enforcement is disabled for this tenant.
        </div>
      </div>
    );
  }

  const summary = await computeTenantSummary({ tenantId });
  const backlinkCandidates = await listListingBacklinkCandidates({ tenantId, limit: 20 });
  const leaks = await listAuthorityLeaks({ tenantId, limit: 20 });

  return (
    <IntegrityClient
      tenantId={tenantId}
      summary={summary}
      backlinkCandidates={backlinkCandidates}
      leaks={leaks}
    />
  );
}
