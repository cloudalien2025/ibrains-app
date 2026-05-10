import WalmartDraftsClient from "@/app/apps/ecomviper/walmart/drafts/drafts-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listDraftsForUser } from "@/lib/ecomviper/walmart/walmart-store";

export const dynamic = "force-dynamic";

export default async function WalmartDraftsPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return <WalmartDraftsClient initialDrafts={[]} />;
  }

  return <WalmartDraftsClient initialDrafts={listDraftsForUser(userId)} />;
}
