/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output: produces a minimal server.js + required files for Docker
  output: "standalone",

  // Enable React strict mode for development warnings
  reactStrictMode: true,

  // Allow the backend API URL to be set at build time via env
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001",
  },

  // Allow images from external sources if needed
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Required: tell the browser the SW is allowed to control the entire origin.
  // Without this header Next.js standalone output restricts SW scope to /_next/
  // and sw.js silently fails to register on /muffliato.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            // SW itself must not be cached aggressively — browser checks for updates
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
