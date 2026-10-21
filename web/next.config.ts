import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "13.126.39.176",
    "13.126.39.176:3000",
    "13.126.39.176:80",
    "localhost",
    "localhost:3000",
  ],
  async rewrites() {
    const apiBase = process.env.INTERNAL_API_URL || "http://localhost:3001";
    return [
      {
        source: "/approvals/:path*",
        destination: `${apiBase}/approvals/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${apiBase}/auth/:path*`,
      },
      {
        source: "/batches/:path*",
        destination: `${apiBase}/batches/:path*`,
      },
      {
        source: "/workflows/:path*",
        destination: `${apiBase}/workflows/:path*`,
      },
      {
        source: "/contacts/:path*",
        destination: `${apiBase}/contacts/:path*`,
      },
      {
        source: "/bills/:path*",
        destination: `${apiBase}/bills/:path*`,
      },
      {
        source: "/payments/:path*",
        destination: `${apiBase}/payments/:path*`,
      },
      {
        source: "/notifications/:path*",
        destination: `${apiBase}/notifications/:path*`,
      },
      {
        source: "/reminders/:path*",
        destination: `${apiBase}/reminders/:path*`,
      },
      {
        source: "/health/:path*",
        destination: `${apiBase}/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
