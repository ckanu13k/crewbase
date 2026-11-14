import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrewPass — craft jobs and training",
    short_name: "CrewPass",
    description: "Find craft work, keep your cards current, and train for the next job. English and Spanish.",
    start_url: "/me",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#111827",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
