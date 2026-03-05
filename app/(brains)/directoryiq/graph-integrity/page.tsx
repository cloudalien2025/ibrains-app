import { headers } from "next/headers";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import GraphIntegrityClient from "./graph-integrity-client";

export const dynamic = "force-dynamic";

export default async function DirectoryIqGraphIntegrityPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const tenantId = "default";
  const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });

  if (!gate.enabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Graph integrity is disabled for this tenant.
        </div>
      </div>
    );
  }

  return <GraphIntegrityClient tenantId={tenantId} />;
}
