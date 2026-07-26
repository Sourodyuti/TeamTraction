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
};

module.exports = nextConfig;

