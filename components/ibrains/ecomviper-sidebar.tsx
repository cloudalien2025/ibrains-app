import IbrainsShellNav, { type IbrainsShellNavItem } from "@/components/ibrains/ibrains-shell-nav";

const ecomViperNavItems: IbrainsShellNavItem[] = [
  { href: "/ecomviper", label: "Products" },
  { href: "/ecomviper/image-studio", label: "Image Studio", disabled: true },
  { href: "/ecomviper/dropshipping/rocktomic", label: "Dropshipping" },
  { href: "/ecomviper/agentic-visibility", label: "Agentic Visibility", disabled: true },
  { href: "/ecomviper/settings", label: "Settings" },
];

export default function EcomViperSidebar() {
  return (
    <div className="space-y-4" data-testid="ecomviper-brain-sidebar">
      <div className="rounded-xl border border-[#D2E3F8] bg-[#F3F8FF] p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0B5FFF] text-xs font-semibold text-white">
            EV
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">EcomViper</p>
            <p className="text-xs text-[#475569]">Brain workspace</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#475569]">
          Shopify catalog operations with supplier intelligence.
        </p>
      </div>

      <IbrainsShellNav items={ecomViperNavItems} />
    </div>
  );
}
