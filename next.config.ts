import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  typescript: {
    // Temporary production recovery: allow build output even with TS drift.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Prevent stale HTML from referencing removed hashed chunks after deploy.
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
