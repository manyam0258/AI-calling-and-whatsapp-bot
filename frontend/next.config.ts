import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Proxy /api/voice/* requests to the Python microservice
  async rewrites() {
    const voiceAgentUrl = process.env.VOICE_AGENT_URL || "http://localhost:8001";
    return [
      {
        source: "/api/voice/:path*",
        destination: `${voiceAgentUrl}/voice/:path*`,
      },
    ];
  },
};

export default nextConfig;
