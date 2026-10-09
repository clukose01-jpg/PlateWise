import type { MetadataRoute } from "next";

// Lets PlateWise be added to a phone's home screen and open like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlateWise",
    short_name: "PlateWise",
    description: "Plan the week's family dinners in a few minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf5ee",
    theme_color: "#fbf5ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
