/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for development warnings
  reactStrictMode: true,

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
