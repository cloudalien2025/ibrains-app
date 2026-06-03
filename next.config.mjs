const nextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["app.ibrains.ai"],
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
