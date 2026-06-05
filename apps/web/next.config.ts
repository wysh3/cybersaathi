import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      {
        source: "/dashboards/public",
        destination: "/dashboards/heatmap",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
