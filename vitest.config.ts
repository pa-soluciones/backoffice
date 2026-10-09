import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Los de integración comparten la base: uno a la vez.
    fileParallelism: false,
    // Los tests de integración usan la base de test (docker compose / servicio de CI).
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://pas:pas@localhost:5432/pas_test",
      R2_ENDPOINT: process.env.TEST_R2_ENDPOINT ?? "http://localhost:9000",
      R2_ACCESS_KEY_ID: "local",
      R2_SECRET_ACCESS_KEY: "local",
      R2_BUCKET: "pas-backoffice",
    },
  },
});
