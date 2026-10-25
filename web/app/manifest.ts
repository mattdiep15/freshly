import type { MetadataRoute } from "next";

// iOS only allows web push for a site added to the Home Screen, which needs a standalone manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "freshly",
    short_name: "freshly",
    description: "Know what's in your fridge and use it before it goes bad.",
    start_url: "/fridge",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
