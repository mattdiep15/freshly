import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The use-soon list moved under the fridge list, so the fridge is home.
  async redirects() {
    return [
      { source: "/", destination: "/fridge", permanent: false },
      // Stats and friends became the two tabs of community in design v6.
      { source: "/stats", destination: "/community?view=numbers", permanent: false },
      { source: "/friends", destination: "/community?view=friends", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
