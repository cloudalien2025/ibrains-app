import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DirectoryIqIntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : {};
  const query = new URLSearchParams();

  const connector = resolved.connector;
  if (typeof connector === "string" && connector.trim()) {
    query.set("connector", connector);
  }

  permanentRedirect(`/directoryiq/signal-sources${query.toString() ? `?${query.toString()}` : ""}`);
}
