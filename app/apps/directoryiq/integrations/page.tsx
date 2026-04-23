import { permanentRedirect } from "next/navigation";

export default function DirectoryIqIntegrationsRedirect() {
  permanentRedirect("/apps/directoryiq/signal-sources");
}
