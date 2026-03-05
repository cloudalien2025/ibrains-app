import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";
import AuthoritySupportClient from "@/app/(brains)/directoryiq/authority-support/authority-support-client";

export const dynamic = "force-dynamic";

export default function DirectoryIqAuthoritySupportAliasPage() {
  return (
    <div className="space-y-4">
      <AuthoritySectionNav />
      <AuthoritySupportClient />
    </div>
  );
}
