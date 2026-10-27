import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SENSITIVE_API_PREFIXES = [
  "/api/affiliate/wallet",
  "/api/affiliate/earnings",
  "/api/affiliate/profile",
  "/api/affiliate/payment-method",
  "/api/affiliate/withdrawal",
  "/api/affiliate/stats",
  "/api/affiliate/orders",
  "/api/affiliate/referrals",
  "/api/affiliate/returns",
  "/api/auth/",
  "/api/affiliate/auth/",
];

const apiNetworkFirst: RuntimeCaching = {
  matcher: ({ url, sameOrigin, request }) => {
    if (!sameOrigin || request.method !== "GET") return false;
    if (!url.pathname.startsWith("/api/")) return false;
    return !SENSITIVE_API_PREFIXES.some((prefix) =>
      url.pathname.startsWith(prefix),
    );
  },
  handler: new NetworkFirst({
    cacheName: "oweg-partners-api",
    networkTimeoutSeconds: 10,
    plugins: [],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkFirst, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();
