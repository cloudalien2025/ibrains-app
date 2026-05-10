import WalmartDraftsClient from "@/app/apps/ecomviper/walmart/drafts/drafts-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";

export const dynamic = "force-dynamic";

export default async function WalmartDraftsPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return <WalmartDraftsClient initialDrafts={[]} />;
  }

  try {
    const drafts = await listWalmartDraftsForUser(userId);
    return <WalmartDraftsClient initialDrafts={drafts} />;
  } catch {
    return (
      <WalmartDraftsClient
        initialDrafts={[]}
        loadError="Could not load drafts right now. Please try again."
      />
    );
  }
}
