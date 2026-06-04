const nextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["app.ibrains.ai"],
      bodySizeLimit: "100mb",
    },
    // Raise the body-clone cap used by Node.js middleware so large file uploads
    // (e.g. multi-page PDF catalogs) are not truncated before formData() parses them.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
