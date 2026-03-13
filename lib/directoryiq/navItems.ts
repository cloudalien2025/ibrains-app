export type DirectoryIqNavItem = {
  href: string;
  label: string;
};

export const directoryIqNavItems: DirectoryIqNavItem[] = [
  { href: "/directoryiq", label: "Dashboard" },
  { href: "/directoryiq/listings", label: "Listings" },
  { href: "/directoryiq/authority", label: "Authority" },
  { href: "/directoryiq/graph-integrity", label: "Graph Integrity" },
  { href: "/directoryiq/signal-sources", label: "Connections" },
  { href: "/directoryiq/versions", label: "History" },
];
