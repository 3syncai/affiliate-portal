import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/offline", revision },
    { url: "/icon.png", revision },
    { url: "/icon-192x192.png", revision },
    { url: "/icon-512x512.png", revision },
    { url: "/icon-512x512-maskable.png", revision },
    { url: "/apple-touch-icon.png", revision },
    { url: "/favicon.ico", revision },
  ],
});

// Get store URL from environment variable
const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/affiliate/:path*",
          destination: `${storeUrl}/api/affiliate/:path*`,
        },
      ],
    };
  },
};

export default withSerwist(nextConfig);
