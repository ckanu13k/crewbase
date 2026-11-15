import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["twilio", "stripe"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  async redirects() {
    return [
      { source: "/recruiter/employers", destination: "/admin/employers", permanent: false },
      { source: "/recruiter/training", destination: "/admin/training", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
