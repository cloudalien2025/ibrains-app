export type SiteForgeSidebarRouteItem = {
  kind: "route";
  href: string;
  label: string;
  description: string;
};

export type SiteForgeSidebarLaneItem = {
  kind: "lane";
  label: string;
  description: string;
};

export type SiteForgeSidebarItem = SiteForgeSidebarRouteItem | SiteForgeSidebarLaneItem;

export const siteforgeSidebarItems: SiteForgeSidebarItem[] = [
  {
    kind: "route",
    href: "/apps/siteforge",
    label: "Command Center",
    description: "SiteForge workspace home",
  },
  {
    kind: "lane",
    label: "Connect",
    description: "Validate WordPress and keys",
  },
  {
    kind: "lane",
    label: "Describe",
    description: "Define intent and plan",
  },
  {
    kind: "lane",
    label: "Launch",
    description: "Run build and review draft",
  },
  {
    kind: "lane",
    label: "Project Status",
    description: "Project and connection state",
  },
];
