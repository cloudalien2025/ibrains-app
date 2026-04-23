import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug?: string[] }>;
};

export default async function LegacyDirectoryIqCatchAllRedirect({ params }: Props) {
  await params;
  redirect("/apps/directoryiq");
}
