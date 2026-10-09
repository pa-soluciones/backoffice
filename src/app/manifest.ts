import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAS Backoffice",
    short_name: "PAS",
    description: "Gestión de presupuestos, obras, stock y documentación de Piedra Angular Solutions.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f6",
    theme_color: "#1f2123",
    lang: "es-AR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
