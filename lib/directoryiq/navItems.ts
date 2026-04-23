export type DirectoryIqNavItem = {
  href: string;
  label: string;
};

export const directoryIqNavItems: DirectoryIqNavItem[] = [
  { href: "/apps/directoryiq", label: "Dashboard" },
  { href: "/apps/directoryiq/listings", label: "Listings" },
  { href: "/apps/directoryiq/authority", label: "Authority" },
  { href: "/apps/directoryiq/graph-integrity", label: "Graph Integrity" },
  { href: "/apps/directoryiq/signal-sources", label: "Connections" },
  { href: "/apps/directoryiq/versions", label: "History" },
];
