import { permanentRedirect } from "next/navigation";

export default function DirectoryIqIntegrationsRedirect() {
  permanentRedirect("/directoryiq/signal-sources");
}
