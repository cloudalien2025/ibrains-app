export type FileIqNavItem = {
  label: string;
  href: string;
};

export const fileIqNavItems: FileIqNavItem[] = [
  { label: "Command Center", href: "/fileiq" },
  { label: "Source Bundles", href: "/fileiq/source-bundles" },
  { label: "Suppliers", href: "/fileiq/suppliers" },
  { label: "Files", href: "/fileiq/files" },
  { label: "Extraction Jobs", href: "/fileiq/extraction-jobs" },
  { label: "Packages", href: "/fileiq/packages" },
  { label: "Review Queue", href: "/fileiq/review-queue" },
  { label: "Validation Reports", href: "/fileiq/validation-reports" },
  { label: "Brain Outputs", href: "/fileiq/brain-outputs" },
  { label: "Settings", href: "/fileiq/settings" },
];
