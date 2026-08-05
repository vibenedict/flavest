import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flavest · Launch Radar",
    short_name: "Flavest",
    description:
      "Real-time CEX/DEX token-launch radar with an anti-rug safety engine, verified on Flare.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0e16",
    theme_color: "#0d0e16",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
