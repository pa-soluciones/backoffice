import { defineConfig, devices } from "@playwright/test";

// Smoke e2e (spec/12-no-funcionales.md RNF-34). Usa una base aparte: pas_test.
export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://pas:pas@localhost:5432/pas_test";
export const ADMIN = { email: "admin@pas.test", password: "bootstrap-e2e-123" };
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, locale: "es-AR", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    // Simulador de la API de Claude (e2e/mock-claude.mjs).
    { command: "node e2e/mock-claude.mjs", url: "http://localhost:3199", reuseExistingServer: false },
    {
      command: `pnpm next build && pnpm next start --port ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        DATABASE_URL: TEST_DB,
        BETTER_AUTH_URL: `http://localhost:${PORT}`,
        ADMIN_BOOTSTRAP_EMAIL: ADMIN.email,
        ADMIN_BOOTSTRAP_PASSWORD: ADMIN.password,
        RESEND_API_KEY: "",
        ANTHROPIC_API_KEY: "test",
        ANTHROPIC_BASE_URL: "http://localhost:3199",
        R2_ENDPOINT: "http://localhost:9000",
        R2_ACCESS_KEY_ID: "pas",
        R2_SECRET_ACCESS_KEY: "local",
        R2_BUCKET: "pas-backoffice",
      },
    },
  ],
});
