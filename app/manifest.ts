import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Hanger",
    short_name: "The Hanger",
    description:
      "Catalogue every piece you own, see what you actually wear, and rediscover the rest.",
    start_url: "/",
    display: "standalone",
    background_color: "#ebe1cb",
    theme_color: "#ebe1cb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
