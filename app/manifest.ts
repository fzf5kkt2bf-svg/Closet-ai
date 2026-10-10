import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meu Closet AI",
    short_name: "Meu Closet",
    description: "Seu guarda-roupa digital pessoal",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f4",
    theme_color: "#55654e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
