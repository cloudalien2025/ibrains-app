export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.NEXT_PUBLIC_RELEASE_SHA ?? process.env.RELEASE_SHA ?? "unknown";
  const built_at = process.env.NEXT_PUBLIC_BUILT_AT ?? process.env.BUILT_AT ?? "unknown";

  return Response.json({ sha, built_at });
}
