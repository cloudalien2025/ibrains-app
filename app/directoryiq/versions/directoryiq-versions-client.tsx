"use client";

import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";

export default function DirectoryIqVersionsClient() {
  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "History"]} searchPlaceholder="Search versions..." />
      <HudCard title="Version History" subtitle="Version snapshots for manual listing and authority actions.">
        <div className="text-sm text-slate-300">No versions available yet.</div>
      </HudCard>
    </>
  );
}
