import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OWEG Partners",
    short_name: "Partners",
    description:
      "OWEG partner portal for sales executives and hierarchy management.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#7AC943",
    categories: ["business"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open your partner dashboard",
        url: "/dashboard",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Referrals",
        short_name: "Referrals",
        description: "View your referrals",
        url: "/dashboard/referrals",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Earnings",
        short_name: "Earnings",
        description: "Track your earnings",
        url: "/dashboard/earnings",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
