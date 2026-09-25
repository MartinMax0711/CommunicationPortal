import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huskyteers Portal",
    short_name: "Huskyteers",
    description: "FTC 19516 team tasks, checklists, and Q&A",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f8f4",
    theme_color: "#4CA256",
    icons: [{ src: "/brand/husky-mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
