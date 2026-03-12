import { headers } from "next/headers";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";
import AuthoritySupportClient from "@/app/(brains)/directoryiq/authority-support/authority-support-client";
import {
  authoritySupportBaseUrl,
  loadAuthoritySupportInitialIssues,
} from "@/app/(brains)/directoryiq/authority-support/initial-issues";

export const dynamic = "force-dynamic";

export default async function DirectoryIqAuthoritySupportAliasPage() {
  const headersList = await headers();
  const { issues, error } = await loadAuthoritySupportInitialIssues(authoritySupportBaseUrl(headersList.get("host")));

  return (
    <div className="space-y-4">
      <AuthoritySectionNav />
      <AuthoritySupportClient initialIssues={issues} initialError={error} />
    </div>
  );
}
