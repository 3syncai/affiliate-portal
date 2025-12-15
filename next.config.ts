import type { NextConfig } from "next";

// Get store URL from environment variable
const storeUrl = process.env.NEXT_PUBLIC_STORE_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/affiliate/:path*',
        destination: `${storeUrl}/api/affiliate/:path*`,
      },
    ];
  },
};

export default nextConfig;
