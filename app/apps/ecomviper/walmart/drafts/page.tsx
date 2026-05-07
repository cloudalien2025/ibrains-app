import WalmartDraftsClient from "@/app/apps/ecomviper/walmart/drafts/drafts-client";
import { listDrafts } from "@/lib/ecomviper/walmart/walmart-store";

export const dynamic = "force-dynamic";

export default function WalmartDraftsPage() {
  return <WalmartDraftsClient initialDrafts={listDrafts()} />;
}
