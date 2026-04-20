import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "iBrains",
  description: "Operational intelligence for platform teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
  const effectivePublishableKey = publishableKey || "pk_test_ibrains_missing_publishable_key";

  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider publishableKey={effectivePublishableKey}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
