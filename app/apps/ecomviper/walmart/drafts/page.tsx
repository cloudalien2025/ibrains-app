import WalmartDraftsClient from "@/app/apps/ecomviper/walmart/drafts/drafts-client";
import { listDrafts, getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartDraftsPage() {
  return <WalmartDraftsClient initialDrafts={listDrafts()} mode={getWalmartRuntimeMode()} />;
}
