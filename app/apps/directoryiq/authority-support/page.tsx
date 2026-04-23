import { headers } from "next/headers";
import AuthoritySupportClient from "./authority-support-client";
import { authoritySupportBaseUrl, loadAuthoritySupportInitialIssues } from "./initial-issues";

export const dynamic = "force-dynamic";

export default async function DirectoryIQAuthoritySupportPage() {
  const headersList = await headers();
  const { issues, error } = await loadAuthoritySupportInitialIssues(authoritySupportBaseUrl(headersList.get("host")));
  return <AuthoritySupportClient initialIssues={issues} initialError={error} />;
}
