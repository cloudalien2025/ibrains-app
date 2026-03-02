import { redirect } from "next/navigation";
import { isBrainId } from "@/lib/brains/brainCatalog";

type BrainDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function BrainDetailPage({ params }: BrainDetailProps) {
  const { id } = await params;
  const normalizedId = id.trim().toLowerCase();

  if (isBrainId(normalizedId)) {
    redirect(`/${normalizedId}`);
  }

  redirect("/brains");
}
