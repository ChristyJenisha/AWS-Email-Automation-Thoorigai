import type { NextConfig } from "next";

const defaultAllowedOrigins = [
  "localhost",
  "localhost:3000",
  "127.0.0.1",
  "127.0.0.1:3000",
];

const envAllowed = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...defaultAllowedOrigins, ...envAllowed],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https: http:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiBase = process.env.INTERNAL_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
      {
        source: "/health",
        destination: `${apiBase}/health`,
      },
      {
        source: "/approvals/:path*",
        destination: `${apiBase}/approvals/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${apiBase}/auth/:path*`,
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
        source: "/notifications/:path*",
        destination: `${apiBase}/notifications/:path*`,
      },
      {
        source: "/reminders/:path*",
        destination: `${apiBase}/reminders/:path*`,
      },
    ];
  },
};

export default nextConfig;
