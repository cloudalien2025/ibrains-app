export type FileIqNavItem = {
  label: string;
  href: string;
  /**
   * Whether the destination route is built and navigable. Phase 1.0 ships only
   * the Command Center page; the remaining items are planned routes (see
   * planning/apps/fileiq/mvp-roadmap.md) and are rendered as non-navigable
   * placeholders until their phase lands. Linking to an unbuilt route renders
   * the not-found boundary (404, or 500 during a Turbopack cold-start window).
   */
  ready: boolean;
};

export const fileIqNavItems: FileIqNavItem[] = [
  { label: "Command Center", href: "/fileiq", ready: true },
  { label: "Source Bundles", href: "/fileiq/source-bundles", ready: false },
  { label: "Suppliers", href: "/fileiq/suppliers", ready: false },
  { label: "Files", href: "/fileiq/files", ready: false },
  { label: "Extraction Jobs", href: "/fileiq/extraction-jobs", ready: false },
  { label: "Packages", href: "/fileiq/packages", ready: false },
  { label: "Review Queue", href: "/fileiq/review-queue", ready: false },
  { label: "Validation Reports", href: "/fileiq/validation-reports", ready: false },
  { label: "Brain Outputs", href: "/fileiq/brain-outputs", ready: false },
  { label: "Settings", href: "/fileiq/settings", ready: false },
];
