import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Plantillas Word que lee el servidor al generar documentos (src/documents/render.ts).
  outputFileTracingIncludes: { "/**": ["./templates/**/*"] },
  partialPrefetching: true,
  // Firma de la empresa (hasta 1 MB) sube por Server Action.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
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
