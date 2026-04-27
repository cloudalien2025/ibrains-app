import type { Metadata } from "next";
import StaleClientRecovery from "@/components/runtime/stale-client-recovery";
import { resolveCurrentReleaseId } from "@/lib/release/currentRelease";
import "./globals.css";

export const metadata: Metadata = {
  title: "iBrains",
  description: "Operational intelligence for platform teams.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const releaseId = await resolveCurrentReleaseId();

  return (
    <html lang="en">
      <body className="antialiased" data-release-id={releaseId ?? undefined}>
        <StaleClientRecovery />
        {children}
      </body>
    </html>
  );
}
