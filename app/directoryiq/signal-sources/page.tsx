import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DirectoryIQSignalSourcesPage() {
  redirect("/directoryiq/settings/integrations");
}
