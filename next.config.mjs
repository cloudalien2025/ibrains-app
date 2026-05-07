const nextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["app.ibrains.ai"],
    },
  },
};

export default nextConfig;
