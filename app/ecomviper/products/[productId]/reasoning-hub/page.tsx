import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink } from "lucide-react";
import CoverageMeter from "@/components/ecomviper/CoverageMeter";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import ReasoningNodesTable, {
  type ReasoningNodeRow,
  type ReasoningNodeStatus,
} from "@/components/ecomviper/ReasoningNodesTable";
import TopBar from "@/components/ecomviper/TopBar";

interface ReasoningResponse {
  product: {
    id: string;
    source_id: string;
    handle: string | null;
    title: string;
    url: string | null;
    image_url: string | null;
    tags: string[];
    ingredients: string | null;
  };
  reasoning_coverage: number;
  linked_blogs: Array<{
    title: string;
    url: string | null;
    status: "Published" | "Missing" | "Linked";
    score: number;
    reason: string;
    link_out: string;
    scheduled_blog_post: string;
  }>;
  error?: string;
}

function mapStatus(value: string): ReasoningNodeStatus {
  if (value === "Published" || value === "Missing" || value === "Linked") return value;
  return "Linked";
}

async function loadReasoning(productId: string): Promise<ReasoningResponse | null> {
  const headersList = await headers();
  const host = headersList.get("host");
  const baseUrl = host ? `http://${host}` : "http://127.0.0.1:3001";

  const response = await fetch(
    `${baseUrl}/api/ecomviper/products/${encodeURIComponent(productId)}/reasoning`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }
  );

  const json = (await response.json().catch(() => null)) as ReasoningResponse | null;
  if (!response.ok || !json) {
    return null;
  }
  return json;
}

export const dynamic = "force-dynamic";

export default async function ProductReasoningHubPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const data = await loadReasoning(productId);

  if (!data?.product) {
    return (
      <>
        <TopBar
          breadcrumbs={["Home", "Blog Interlinking", "Product Reasoning Hub", productId]}
          searchPlaceholder="Search topic node or scheduled post..."
          userLabel="Ariel Viper"
        />

        <HudCard title="Product not found" subtitle="Ingest your Shopify store before opening this reasoning hub.">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/ecomviper/settings/integrations">
              <NeonButton>Go to Integrations</NeonButton>
            </Link>
          </div>
        </HudCard>
      </>
    );
  }

  const rows: ReasoningNodeRow[] = data.linked_blogs.map((blog) => ({
    topicNode: blog.reason || "Related article",
    scheduledBlogPost: blog.scheduled_blog_post,
    linkOut: blog.link_out,
    status: mapStatus(blog.status),
    actionLabel: blog.status === "Missing" ? "Draft" : "Linked",
  }));

  return (
    <>
      <TopBar
        breadcrumbs={[
          "Home",
          "Blog Interlinking",
          "Product Reasoning Hub",
          data.product.title,
        ]}
        searchPlaceholder="Search topic node or scheduled post..."
        userLabel="Ariel Viper"
      />

      <HudCard
        title={`${data.product.title} Product Reasoning Hub`}
        subtitle="Reasoning map for SEO-aware blog interlinking and topical authority."
        actions={<NeonButton>Generate Blog Blueprint</NeonButton>}
      >
        <div className="grid gap-5 lg:grid-cols-[170px_1fr]">
          <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(30,41,59,0.92),rgba(15,23,42,0.85))]">
            {data.product.image_url ? (
              <img
                src={data.product.image_url}
                alt={data.product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs uppercase tracking-[0.16em] text-cyan-200/90">Product Image</span>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(data.product.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100"
                >
                  {tag}
                </span>
              ))}
            </div>

            <CoverageMeter value={data.reasoning_coverage} />

            <div className="text-sm text-slate-300">
              <span className="text-slate-400">Ingredients: </span>
              {data.product.ingredients ?? "Not detected from product content"}
            </div>

            <Link
              href={data.product.url ?? "#"}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              View Product Page
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </HudCard>

      <HudCard
        title="Blog Post Reasoning Nodes"
        subtitle="Coverage map of topical nodes and linked Shopify blog articles."
      >
        <ReasoningNodesTable rows={rows} />
      </HudCard>
    </>
  );
}
