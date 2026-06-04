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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=Azeret+Mono:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" data-release-id={releaseId ?? undefined}>
        <StaleClientRecovery />
        {children}
      </body>
    </html>
  );
}
